import { NextRequest, NextResponse } from 'next/server'
import { gzipSync } from 'zlib'
import { createAdminClient } from '@/lib/supabase-server'

// Snapshot JSON de TODAS las tablas públicas, comprimido y subido al
// bucket privado "backups" (ver migración 027) — lo dispara el cron de
// Vercel definido en vercel.json. Capa adicional e independiente a los
// backups nativos de Supabase: da un punto de recuperación rápido y
// legible (como el que salvó la proforma 3-0253 el 2026-10-05, ahí fue
// un PDF cacheado por casualidad, no un backup real) sin depender de
// restaurar todo el proyecto desde el dashboard de Supabase.
export const maxDuration = 300

const RETENCION_DIAS = 14
const LOTE = 1000 // PostgREST no garantiza traer más de esto por request

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: tablasData, error: errorTablas } = await admin.rpc('listar_tablas_backup')
  if (errorTablas || !tablasData) {
    return NextResponse.json({ error: `No se pudo listar tablas: ${errorTablas?.message}` }, { status: 500 })
  }
  const tablas: string[] = tablasData.map((t: { tabla: string }) => t.tabla)

  const resultado: Record<string, unknown[]> = {}
  const conteos: Record<string, number> = {}
  const errores: Record<string, string> = {}

  for (const tabla of tablas) {
    const filas: unknown[] = []
    let desde = 0
    for (;;) {
      const { data, error } = await admin.from(tabla).select('*').range(desde, desde + LOTE - 1)
      if (error) { errores[tabla] = error.message; break }
      if (!data || data.length === 0) break
      filas.push(...data)
      if (data.length < LOTE) break
      desde += LOTE
    }
    resultado[tabla] = filas
    conteos[tabla] = filas.length
  }

  const tomadoEn = new Date().toISOString()
  const payload = JSON.stringify({ tomado_en: tomadoEn, tablas: resultado })
  const comprimido = gzipSync(Buffer.from(payload, 'utf-8'))

  const nombreArchivo = `${tomadoEn.replace(/[:.]/g, '-')}.json.gz`
  const { error: errorUpload } = await admin.storage
    .from('backups')
    .upload(nombreArchivo, comprimido, { contentType: 'application/gzip' })

  if (errorUpload) {
    return NextResponse.json({ error: `Error subiendo backup: ${errorUpload.message}`, conteos, errores }, { status: 500 })
  }

  const eliminados = await eliminarBackupsViejos(admin)

  return NextResponse.json({
    ok: true,
    archivo: nombreArchivo,
    tamano_bytes: comprimido.length,
    tablas_respaldadas: tablas.length,
    conteos,
    errores: Object.keys(errores).length > 0 ? errores : undefined,
    backups_eliminados_por_retencion: eliminados,
  })
}

async function eliminarBackupsViejos(admin: ReturnType<typeof createAdminClient>): Promise<string[]> {
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
