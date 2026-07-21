/**
 * Inserta costos manuales proporcionados por el usuario para 3-0192 y 3-0160.
 * Uso: node insert-costos-manuales.js [--dry-run]
 */
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../app/.env.local') })

const DRY_RUN = process.argv.includes('--dry-run')
if (DRY_RUN) console.log('DRY RUN\n')

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const COSTOS = {
  '3-0192': {
    'BX7725-100': 95.65,
    '7719-100':   68.75,
    '7713-80':    57.55,
    '7750-120':  119.75,
    '7747-120':  128.65,
  },
  '3-0160': {
    'W1':  15.85, 'W2':  16.85, 'W3':  15.45, 'W4':  16.45, 'W5':  18.55,
    'W6':  17.95, 'W7':  25.55, 'W8':  27.55, 'W9':  24.55, 'W10': 26.55,
    'W11': 29.95, 'W12': 28.95, 'W13': 30.15, 'W14': 29.15, 'W15': 35.75,
    'W16': 37.25, 'W17': 40.15, 'W18': 35.75, 'W19': 38.95, 'W20': 44.65,
    'W21': 42.75, 'W22': 44.25, 'W23': 47.75, 'W24': 41.75, 'W25': 45.25,
    'W26': 52.25, 'W27': 49.35, 'W28': 49.85, 'W29': 53.95, 'W30': 47.35,
    'W31': 51.35, 'W32': 58.35, 'W33': 54.85,
  },
}

let lineasOk = 0, historialOk = 0

async function actualizarProforma(numero, mapa) {
  console.log(`\n${'='.repeat(50)}\n${numero}`)

  const { data: pf } = await sb.from('proformas').select('id, cliente_id').eq('numero', numero).single()
  if (!pf) { console.error('  Proforma no encontrada'); return }

  const { data: lineas } = await sb.from('proforma_lineas')
    .select('id, codigo_pdf, precio_cliente_usd, cantidad')
    .eq('proforma_id', pf.id)

  for (const l of lineas || []) {
    const fob = mapa[l.codigo_pdf]
    if (fob == null) { console.log(`  SIN DATO: ${l.codigo_pdf}`); continue }

    const margen = l.precio_cliente_usd ? l.precio_cliente_usd / fob - 1 : null
    const subtotal = fob * (l.cantidad || 1)

    if (DRY_RUN) {
      console.log(`  [DRY] ${l.codigo_pdf}: costo=$${fob} margen=${margen != null ? (margen*100).toFixed(1)+'%' : 'n/a'}`)
      lineasOk++; continue
    }

    const { error } = await sb.from('proforma_lineas')
      .update({ precio_costo_usd: fob, margen_pct: margen, subtotal_costo_usd: subtotal })
      .eq('id', l.id)

    if (error) console.error(`  ERROR ${l.codigo_pdf}: ${error.message}`)
    else { console.log(`  ✓ ${l.codigo_pdf}: $${fob}`); lineasOk++ }
  }

  // Historial
  const { data: hist } = await sb.from('historial_precios')
    .select('id, codigo_pdf, precio_cliente_usd')
    .eq('proforma_id', pf.id)
    .is('precio_costo_usd', null)

  for (const h of hist || []) {
    const fob = mapa[h.codigo_pdf]
    if (fob == null) continue
    const margen = h.precio_cliente_usd ? h.precio_cliente_usd / fob - 1 : null

    if (DRY_RUN) { historialOk++; continue }

    const { error } = await sb.from('historial_precios')
      .update({ precio_costo_usd: fob, margen_pct: margen })
      .eq('id', h.id)

    if (!error) historialOk++
  }
}

for (const [numero, mapa] of Object.entries(COSTOS)) {
  await actualizarProforma(numero, mapa)
}

console.log(`\n${'='.repeat(50)}`)
console.log(`Líneas actualizadas: ${lineasOk}`)
console.log(`Historial actualizado: ${historialOk}`)
