/**
 * Genera Excel de revisión para proformas sin total_fob_usd.
 * 3 hojas: A) Solo falta total, B) Sin precio cliente, C) Vacías completamente.
 * Salida: Desktop/Europartners_Proformas_SinValor_YYYY-MM-DD.xlsx
 */
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import dotenv from 'dotenv'
import path from 'path'
import os from 'os'

dotenv.config({ path: path.resolve('../../app/.env.local') })
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

function usd(v) { return v != null ? Number(Number(v).toFixed(2)) : null }
function pct(v) { return v != null ? Number((v * 100).toFixed(1)) : null }
function fecha(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function encabezado(ws, cols) {
  const s = { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
               fill: { fgColor: { rgb: '1E3A5F' } },
               alignment: { horizontal: 'center', vertical: 'center' } }
  cols.forEach((_, c) => { const a = XLSX.utils.encode_cell({r:0,c}); if (ws[a]) ws[a].s = s })
}

function colorFila(ws, fila, r, rgb) {
  const s = { fill: { fgColor: { rgb } }, font: { sz: 9 } }
  fila.forEach((_, c) => { const a = XLSX.utils.encode_cell({r,c}); if (ws[a]) ws[a].s = s })
}

async function main() {
  // ── Cargar todas las proformas con total null/0 ──────────────────────────
  const { data: pfs } = await sb.from('proformas')
    .select('id, numero, fecha, estado, incoterm, clientes(nombre, slug)')
    .or('total_fob_usd.is.null,total_fob_usd.eq.0')
    .order('numero')

  const grupoA = [], grupoB = [], grupoC = []

  for (const pf of pfs) {
    const { data: lineas } = await sb.from('proforma_lineas')
      .select('orden, codigo_pdf, descripcion_pdf, cantidad, precio_cliente_usd, precio_costo_usd, margen_pct')
      .eq('proforma_id', pf.id)
      .order('orden')

    if (!lineas || lineas.length === 0) {
      grupoC.push({ pf, lineas: [] })
      continue
    }

    const conCliente = lineas.filter(l => l.precio_cliente_usd > 0).length
    if (conCliente === 0) {
      grupoB.push({ pf, lineas })
    } else {
      const total = lineas.reduce((s,l) => s + (l.precio_cliente_usd||0)*(l.cantidad||1), 0)
      grupoA.push({ pf, lineas, total })
    }
  }

  const wb = XLSX.utils.book_new()

  // ── HOJA A: Tienen precio cliente — solo falta total ─────────────────────
  const encA = ['Proforma #','Fecha','Cliente','Incoterm','Código','Descripción','Cant.','Precio Cliente','Total Línea','Costo China','Margen %','→ Total Proforma calculado']
  const filasA = []
  for (const { pf, lineas, total } of grupoA) {
    lineas.forEach((l, i) => {
      const subtotal = (l.precio_cliente_usd||0) * (l.cantidad||1)
      filasA.push([
        pf.numero, fecha(pf.fecha), pf.clientes?.nombre, pf.incoterm,
        l.codigo_pdf, l.descripcion_pdf, l.cantidad,
        usd(l.precio_cliente_usd), usd(subtotal),
        usd(l.precio_costo_usd), pct(l.margen_pct),
        i === 0 ? usd(total) : null,  // solo en la primera fila de cada proforma
      ])
    })
  }
  const wsA = XLSX.utils.aoa_to_sheet([encA, ...filasA])
  wsA['!cols'] = [{wch:12},{wch:11},{wch:22},{wch:9},{wch:14},{wch:38},{wch:6},{wch:16},{wch:13},{wch:14},{wch:10},{wch:22}]
  wsA['!freeze'] = { xSplit: 0, ySplit: 1 }
  encabezado(wsA, encA)
  filasA.forEach((f, i) => colorFila(wsA, f, i+1, i%2===0 ? 'D1FAE5' : 'ECFDF5'))

  // ── HOJA B: Tienen líneas pero solo PI Emily (sin precio cliente) ─────────
  const encB = ['Proforma #','Fecha','Cliente','Incoterm','Código','Descripción','Cant.','Precio Cliente → completar','Costo China (referencia)','Margen % estimado','Notas']
  const filasB = []
  for (const { pf, lineas } of grupoB) {
    lineas.forEach((l, i) => {
      filasB.push([
        pf.numero, fecha(pf.fecha), pf.clientes?.nombre, pf.incoterm,
        l.codigo_pdf, l.descripcion_pdf, l.cantidad,
        '',                          // vacío para completar
        usd(l.precio_costo_usd),
        '',                          // margen se calculará cuando pongan precio
        i === 0 ? `${lineas.length} líneas` : '',
      ])
    })
  }
  const wsB = XLSX.utils.aoa_to_sheet([encB, ...filasB])
  wsB['!cols'] = [{wch:12},{wch:11},{wch:22},{wch:9},{wch:14},{wch:38},{wch:6},{wch:22},{wch:18},{wch:14},{wch:10}]
  wsB['!freeze'] = { xSplit: 0, ySplit: 1 }
  encabezado(wsB, encB)
  // Alternar color por proforma
  let pfActual = '', colorIdx = 0
  filasB.forEach((f, i) => {
    if (f[0] !== pfActual) { pfActual = f[0]; colorIdx++ }
    colorFila(wsB, f, i+1, colorIdx%2===0 ? 'FFF9C4' : 'FEF3C7')
    // Columna "Precio Cliente → completar" en verde suave
    const a = XLSX.utils.encode_cell({r: i+1, c: 7})
    if (wsB[a]) wsB[a].s = { fill:{fgColor:{rgb:'E8F5E9'}}, font:{sz:9}, border:{bottom:{style:'thin',color:{rgb:'AAAAAA'}}} }
  })

  // ── HOJA C: Completamente vacías ─────────────────────────────────────────
  const encC = ['Proforma #','Fecha','Cliente','Incoterm','Estado','Acción sugerida']
  const filasC = grupoC.map(({ pf }) => [
    pf.numero, fecha(pf.fecha), pf.clientes?.nombre, pf.incoterm, pf.estado,
    pf.estado === 'borrador' ? 'Eliminar o completar manualmente' : 'Buscar Excel en OneDrive',
  ])
  const wsC = XLSX.utils.aoa_to_sheet([encC, ...filasC])
  wsC['!cols'] = [{wch:12},{wch:11},{wch:22},{wch:9},{wch:12},{wch:34}]
  wsC['!freeze'] = { xSplit: 0, ySplit: 1 }
  encabezado(wsC, encC)
  filasC.forEach((f, i) => {
    const rgb = f[4] === 'borrador' ? 'FFE4E6' : 'FEE2E2'
    colorFila(wsC, f, i+1, rgb)
  })

  // ── Ensamblar ─────────────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, wsA, '✅ A — Calcular total')
  XLSX.utils.book_append_sheet(wb, wsB, '📝 B — Completar precio cliente')
  XLSX.utils.book_append_sheet(wb, wsC, '⚠️ C — Vacías')

  const hoy = new Date().toISOString().split('T')[0]
  const salida = path.join(os.homedir(), 'Desktop', `Europartners_Proformas_SinValor_${hoy}.xlsx`)
  XLSX.writeFile(wb, salida, { bookSST: false, type: 'file', cellStyles: true })

  console.log(`✓ Excel generado: ${salida}`)
  console.log(`  ✅ A (solo falta total):       ${grupoA.length} proformas`)
  console.log(`  📝 B (sin precio cliente):     ${grupoB.length} proformas, ${filasB.length} líneas`)
  console.log(`  ⚠️  C (vacías):                ${grupoC.length} proformas`)
}

main().catch(e => { console.error(e); process.exit(1) })
