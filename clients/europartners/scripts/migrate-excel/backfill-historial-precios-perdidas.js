/**
 * Backfill de historial_precios para las aprobaciones reales que se perdieron
 * por el bug de columnas inexistentes (variante_id/componente_id) en
 * aprobar/route.ts y aprobacion-token/route.ts — corregido el 2026-08-19,
 * ver lib/historialPrecios.ts. Ninguna aprobación en vivo desde el 24-jul-2026
 * había quedado registrada en historial_precios; este script rellena esas
 * filas usando exactamente el mismo shape que el código ya corregido, sin
 * tocar nada más.
 *
 * Uso: node backfill-historial-precios-perdidas.js                              (dry-run, todas)
 *      node backfill-historial-precios-perdidas.js --write                     (aplica todas)
 *      node backfill-historial-precios-perdidas.js --write --solo=3-0240,3-0242 (aplica solo esas)
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WRITE = process.argv.includes('--write')
const soloArg = process.argv.find(a => a.startsWith('--solo='))
const SOLO = soloArg ? new Set(soloArg.slice('--solo='.length).split(',').map(s => s.trim())) : null

const envPath = path.join(__dirname, '..', '..', 'app', '.env.local')
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

async function main() {
  console.log(`Modo: ${WRITE ? 'ESCRITURA REAL' : 'DRY-RUN (usa --write para aplicar)'}\n`)

  const { data: eventos, error: eEventos } = await admin
    .from('proforma_eventos')
    .select('proforma_id, created_at')
    .eq('estado_hacia', 'aprobada')
    .order('created_at', { ascending: true })

  if (eEventos) throw eEventos

  const proformaIds = Array.from(new Set((eventos || []).map(e => e.proforma_id)))
  console.log(`${proformaIds.length} proforma(s) con evento de aprobación en proforma_eventos.\n`)

  let totalFilasInsertadas = 0
  let proformasYaTenianHistorial = 0
  let proformasSinLineas = 0

  for (const proformaId of proformaIds) {
    const { data: yaExiste } = await admin
      .from('historial_precios')
      .select('id')
      .eq('proforma_id', proformaId)
      .limit(1)

    if (yaExiste && yaExiste.length > 0) {
      proformasYaTenianHistorial++
      continue
    }

    const { data: proforma, error: eProforma } = await admin
      .from('proformas')
      .select('id, numero, fecha, cliente_id, lineas:proforma_lineas(producto_id, codigo_pdf, descripcion_pdf, precio_costo_usd, precio_cliente_usd, margen_pct)')
      .eq('id', proformaId)
      .single()

    if (eProforma || !proforma) {
      console.log(`  ! No se pudo cargar la proforma ${proformaId}: ${eProforma?.message}`)
      continue
    }

    if (SOLO && !SOLO.has(proforma.numero)) {
      continue
    }

    const lineas = proforma.lineas || []
    if (lineas.length === 0) {
      proformasSinLineas++
      console.log(`  - ${proforma.numero}: sin líneas, se omite.`)
      continue
    }

    const filas = lineas.map(l => ({
      cliente_id: proforma.cliente_id,
      producto_id: l.producto_id,
      proforma_id: proforma.id,
      proforma_numero: proforma.numero,
      fecha_proforma: proforma.fecha,
      codigo_pdf: l.codigo_pdf,
      descripcion_pdf: l.descripcion_pdf,
      precio_costo_usd: l.precio_costo_usd,
      precio_cliente_usd: l.precio_cliente_usd,
      margen_pct: l.margen_pct,
    }))

    console.log(`  + ${proforma.numero}: ${filas.length} línea(s) a insertar en historial_precios.`)

    if (WRITE) {
      const { error: eInsert } = await admin.from('historial_precios').insert(filas)
      if (eInsert) {
        console.log(`    ! Error insertando: ${eInsert.message}`)
        continue
      }
    }
    totalFilasInsertadas += filas.length
  }

  console.log(`\nResumen: ${proformaIds.length} aprobaciones revisadas, ${proformasYaTenianHistorial} ya tenían historial, ${proformasSinLineas} sin líneas, ${totalFilasInsertadas} fila(s) ${WRITE ? 'insertadas' : 'a insertar (dry-run)'}.`)
}

main().catch(e => { console.error(e); process.exit(1) })
