import { NextRequest, NextResponse } from 'next/server'
import { gzipSync } from 'zlib'
import { createAdminClient } from '@/lib/supabase-server'
import { enviarAlertaBackupFallido } from '@/lib/email'

// Snapshot JSON de TODAS las tablas públicas, comprimido y subido al
// bucket privado "backups" (ver migración 027) — lo dispara el cron de
// Vercel definido en vercel.json. Capa adicional e independiente a los
// backups nativos de Supabase: da un punto de recuperación rápido y
// legible (como el que salvó la proforma 3-0253 el 2026-10-05, ahí fue
// un PDF cacheado por casualidad, no un backup real) sin depender de
// restaurar todo el proyecto desde el dashboard de Supabase.
//
// nov-2026: se agregó el respaldo de los buckets públicos de Storage
// (productos, documentos) y la alerta por correo cuando algo falla --
// hasta entonces el backup de Storage no existía y un fallo del cron
// solo se veía entrando a mano a los logs de Vercel.
export const maxDuration = 300

const RETENCION_DIAS = 14
const LOTE = 1000 // PostgREST/Storage no garantizan traer más de esto por request
const BUCKETS_STORAGE_A_RESPALDAR = ['productos', 'documentos'] as const
const CONCURRENCIA_COPIA = 5 // copias simultáneas al respaldar Storage -- con 10 el plan free de Supabase devolvía "Too many connections issued to the database" en pruebas reales sobre los ~600 objetos de "productos"

type AdminClient = ReturnType<typeof createAdminClient>

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const tomadoEn = new Date().toISOString()
  const fecha = tomadoEn.slice(0, 10) // YYYY-MM-DD -- carpeta compartida por el snapshot de tablas y el de Storage del mismo día

  // ── Tablas ─────────────────────────────────────────────────────
  const { data: tablasData, error: errorTablas } = await admin.rpc('listar_tablas_backup')
  if (errorTablas || !tablasData) {
    const mensaje = `No se pudo listar tablas: ${errorTablas?.message}`
    await notificarFalloSiAplica(admin, { fecha, errorGeneral: mensaje })
    return NextResponse.json({ error: mensaje }, { status: 500 })
  }
  const tablas: string[] = tablasData.map((t: { tabla: string }) => t.tabla)

  const resultado: Record<string, unknown[]> = {}
  const conteos: Record<string, number> = {}
  const erroresTablas: Record<string, string> = {}

  for (const tabla of tablas) {
    const filas: unknown[] = []
    let desde = 0
    for (;;) {
      const { data, error } = await admin.from(tabla).select('*').range(desde, desde + LOTE - 1)
      if (error) { erroresTablas[tabla] = error.message; break }
      if (!data || data.length === 0) break
      filas.push(...data)
      if (data.length < LOTE) break
      desde += LOTE
    }
    resultado[tabla] = filas
    conteos[tabla] = filas.length
  }

  const payload = JSON.stringify({ tomado_en: tomadoEn, tablas: resultado })
  const comprimido = gzipSync(Buffer.from(payload, 'utf-8'))

  const nombreArchivo = `${tomadoEn.replace(/[:.]/g, '-')}.json.gz`
  const { error: errorUpload } = await admin.storage
    .from('backups')
    .upload(nombreArchivo, comprimido, { contentType: 'application/gzip' })

  if (errorUpload) {
    const mensaje = `Error subiendo backup: ${errorUpload.message}`
    await notificarFalloSiAplica(admin, { fecha, errorGeneral: mensaje, erroresTablas })
    return NextResponse.json({ error: mensaje, conteos, errores: erroresTablas }, { status: 500 })
  }

  // ── Storage (productos, documentos) ───────────────────────────
  const { errores: erroresStorage, copiados: objetosStorageRespaldados } = await respaldarStorage(admin, fecha)

  // ── Poda a 14 días (tablas y Storage) ──────────────────────────
  const eliminados = await eliminarBackupsViejos(admin)
  const eliminadosStorage = await eliminarBackupsStorageViejos(admin)

  // Hook de prueba para verificar la alerta sin tocar datos reales --
  // inerte en producción (NODE_ENV siempre es 'production' ahí). Permite
  // simular un fallo con GET .../api/cron/backup?simular_error=1 en dev.
  const simularError = process.env.NODE_ENV !== 'production' && req.nextUrl.searchParams.get('simular_error') === '1'
  if (simularError) erroresStorage['_prueba'] = 'Error simulado vía ?simular_error=1 (solo activo fuera de producción) para verificar la alerta de correo.'

  const huboErrores = Object.keys(erroresTablas).length > 0 || Object.keys(erroresStorage).length > 0
  if (huboErrores) {
    await notificarFalloSiAplica(admin, { fecha, erroresTablas, erroresStorage })
  }

  return NextResponse.json({
    ok: !huboErrores,
    archivo: nombreArchivo,
    tamano_bytes: comprimido.length,
    tablas_respaldadas: tablas.length,
    conteos,
    objetos_storage_respaldados: objetosStorageRespaldados,
    errores: Object.keys(erroresTablas).length > 0 ? erroresTablas : undefined,
    errores_storage: Object.keys(erroresStorage).length > 0 ? erroresStorage : undefined,
    backups_eliminados_por_retencion: eliminados,
    backups_storage_eliminados_por_retencion: eliminadosStorage,
  })
}

// Copia los objetos de cada bucket público hacia backups/storage/{fecha}/{bucket}/...
// usando el copy() server-side de Storage (acepta destinationBucket distinto al
// de origen) -- no descarga ni resube el archivo por nuestra red, Supabase lo
// mueve internamente. Sigue el mismo patrón de "nunca tragar errores" que el
// resto del cron: cada copia fallida queda registrada, pero una falla puntual
// no detiene el resto del respaldo.
async function respaldarStorage(
  admin: AdminClient,
  fecha: string
): Promise<{ errores: Record<string, string>; copiados: number }> {
  const errores: Record<string, string> = {}
  let copiados = 0

  for (const bucket of BUCKETS_STORAGE_A_RESPALDAR) {
    const { rutas, error } = await listarObjetosRecursivo(admin, bucket)
    if (error) {
      errores[bucket] = `No se pudo listar el bucket: ${error}`
      continue
    }

    for (let i = 0; i < rutas.length; i += CONCURRENCIA_COPIA) {
      const lote = rutas.slice(i, i + CONCURRENCIA_COPIA)
      const resultados = await Promise.all(
        lote.map(async (ruta) => {
          const destino = `storage/${fecha}/${bucket}/${ruta}`
          const { error } = await copiarObjetoConReintentos(admin, bucket, ruta, destino)
          return { ruta, error }
        })
      )
      for (const r of resultados) {
        if (r.error) errores[`${bucket}/${r.ruta}`] = r.error
        else copiados++
      }
    }
  }

  return { errores, copiados }
}

// Copia un objeto con reintentos -- el plan free de Supabase devuelve "Too
// many connections issued to the database" cuando hay demasiadas copias
// simultáneas (visto en pruebas reales con CONCURRENCIA_COPIA=10 sobre los
// ~600 objetos de "productos"), y copy() no soporta upsert: un reintento
// manual el mismo día choca con "The resource already exists" porque la
// carpeta de hoy ya tiene ese archivo. Ambos casos son recuperables sin
// perder nada -- solo hay que limpiar o esperar y volver a intentar.
async function copiarObjetoConReintentos(
  admin: AdminClient,
  bucket: string,
  ruta: string,
  destino: string,
  intentosMax = 4
): Promise<{ error?: string }> {
  for (let intento = 1; intento <= intentosMax; intento++) {
    const { error } = await admin.storage.from(bucket).copy(ruta, destino, { destinationBucket: 'backups' })
    if (!error) return {}

    if (/already exists/i.test(error.message)) {
      // Borra la copia vieja antes de reintentar -- si no, el backup se
      // queda con el contenido de una corrida anterior del mismo día aunque
      // el archivo de origen haya cambiado.
      await admin.storage.from('backups').remove([destino])
      continue
    }

    const esTransitorio = /too many connections|timeout|rate limit/i.test(error.message)
    if (esTransitorio && intento < intentosMax) {
      await new Promise(resolve => setTimeout(resolve, 400 * intento))
      continue
    }

    return { error: error.message }
  }
  return { error: 'No se pudo copiar tras varios reintentos' }
}

// Lista todos los objetos de un bucket (o de un prefijo/carpeta dentro de
// él), bajando recursivamente por las "carpetas" que Storage representa
// como entradas con id === null. Pagina igual que el loop de tablas de
// arriba, por si algún bucket crece más allá de LOTE objetos en un mismo
// nivel.
async function listarObjetosRecursivo(
  admin: AdminClient,
  bucket: string,
  prefix = ''
): Promise<{ rutas: string[]; error?: string }> {
  const rutas: string[] = []
  let desde = 0
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: LOTE, offset: desde })
    if (error) return { rutas, error: error.message }
    if (!data || data.length === 0) break

    for (const item of data) {
      const ruta = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id === null) {
        const sub = await listarObjetosRecursivo(admin, bucket, ruta)
        if (sub.error) return { rutas, error: sub.error }
        rutas.push(...sub.rutas)
      } else {
        rutas.push(ruta)
      }
    }

    if (data.length < LOTE) break
    desde += LOTE
  }
  return { rutas }
}

async function eliminarBackupsViejos(admin: AdminClient): Promise<string[]> {
  const { data: archivos } = await admin.storage.from('backups').list('', { limit: 1000 })
  if (!archivos) return []

  const limite = Date.now() - RETENCION_DIAS * 24 * 60 * 60 * 1000
  const viejos = archivos
    .filter(a => a.created_at && new Date(a.created_at).getTime() < limite)
    .map(a => a.name)

  if (viejos.length === 0) return []
  await admin.storage.from('backups').remove(viejos)
  return viejos
}

// Poda las carpetas-fecha de backups/storage/ más viejas que RETENCION_DIAS.
// Storage no permite borrar una "carpeta" directamente -- hay que listar
// todos los archivos que contiene y pasarle esa lista a remove().
async function eliminarBackupsStorageViejos(admin: AdminClient): Promise<string[]> {
  const { data: carpetas, error } = await admin.storage.from('backups').list('storage', { limit: 1000 })
  if (error || !carpetas) return []

  const limite = Date.now() - RETENCION_DIAS * 24 * 60 * 60 * 1000
  const eliminadas: string[] = []

  for (const carpeta of carpetas) {
    const fechaCarpeta = new Date(`${carpeta.name}T00:00:00Z`)
    if (isNaN(fechaCarpeta.getTime()) || fechaCarpeta.getTime() >= limite) continue

    const { rutas } = await listarObjetosRecursivo(admin, 'backups', `storage/${carpeta.name}`)
    if (rutas.length > 0) {
      await admin.storage.from('backups').remove(rutas)
    }
    eliminadas.push(`storage/${carpeta.name}`)
  }

  return eliminadas
}

// Busca el admin activo (mismo criterio que el resto del proyecto, ver
// enviar-revision/route.ts) y le manda la alerta -- si algo de esto falla
// (no hay admin, Resend falla, etc.) solo se loguea: una alerta rota nunca
// debe tumbar la respuesta del cron.
async function notificarFalloSiAplica(
  admin: AdminClient,
  detalle: {
    fecha: string
    errorGeneral?: string
    erroresTablas?: Record<string, string>
    erroresStorage?: Record<string, string>
  }
): Promise<void> {
  try {
    const { data: marta } = await admin
      .from('usuarios')
      .select('email')
      .eq('rol', 'admin')
      .eq('activo', true)
      .limit(1)
      .single()

    if (!marta?.email) {
      console.error('[cron/backup] falló y no se pudo notificar: no hay admin activo con email')
      return
    }

    await enviarAlertaBackupFallido(marta.email, detalle)
  } catch (e) {
    console.error('[cron/backup] falló y además no se pudo enviar la alerta por correo:', e)
  }
}
