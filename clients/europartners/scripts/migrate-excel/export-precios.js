/**
 * export-precios.js
 * Genera un Excel con dos hojas:
 *   1. RESUMEN  — una fila por referencia, costo China + precio por cliente
 *   2. HISTORIAL — una fila por entrada de historial (audit trail completo)
 *
 * Uso: node export-precios.js
 * Salida: Desktop/Europartners_Precios_YYYY-MM-DD.xlsx
 */

import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import dotenv from 'dotenv'
import path from 'path'
import os from 'os'

dotenv.config({ path: path.resolve('../../app/.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function usd(v) { return v != null ? Number(Number(v).toFixed(4)) : null }
function pct(v) { return v != null ? Number((v * 100).toFixed(2)) : null }

function fechaLegible(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function estiloEncabezado() {
  return {
    font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
    fill:      { fgColor: { rgb: '1E3A5F' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      bottom: { style: 'thin', color: { rgb: 'AAAAAA' } },
      right:  { style: 'thin', color: { rgb: 'AAAAAA' } },
    },
  }
}

function estiloCategoria(catNombre) {
  const colores = {
    'Sanitarios':    'DBEAFE',
    'Wash Basins':   'CFFAFE',
    'Seat Covers':   'EDE9FE',
    'Cabinets':      'FEF3C7',
    'Puertas':       'D1FAE5',
    'Ventanas':      'E0F2FE',
    'Shower Doors':  'CCFBF1',
    'Gypsum':        'F3F4F6',
    'Coolers':       'FFEDD5',
    'Kitchen Sinks': 'FFE4E6',
  }
  const rgb = colores[catNombre] || 'FFFFFF'
  return { fill: { fgColor: { rgb } }, font: { sz: 9 } }
}

// Aplica estilos a un rango de celdas
function aplicarEstiloRango(ws, filaDesde, filaHasta, colDesde, colHasta, estilo) {
  for (let r = filaDesde; r <= filaHasta; r++) {
    for (let c = colDesde; c <= colHasta; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (ws[addr]) ws[addr].s = estilo
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Conectando a Supabase...')

  // 1. Cargar clientes (orden fijo)
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, slug')
    .eq('activo', true)
    .order('nombre', { ascending: true })

  console.log(`Clientes: ${clientes.map(c => c.nombre).join(', ')}`)

  // 2. Cargar historial completo
  const { data: historial, error } = await supabase
    .from('historial_precios')
    .select(`
      id, proforma_numero, fecha_proforma,
      precio_costo_usd, precio_cliente_usd, margen_pct,
      codigo_pdf, descripcion_pdf,
      cliente_id,
      clientes ( nombre ),
      productos (
        categorias_producto ( nombre )
      )
    `)
    .not('codigo_pdf', 'is', null)
    .order('codigo_pdf', { ascending: true })
    .order('fecha_proforma', { ascending: false })

  if (error) { console.error('Error:', error.message); process.exit(1) }
  console.log(`Registros de historial: ${historial.length}`)

  // 3. ── HOJA 1: RESUMEN ─────────────────────────────────────────────────────
  // Una fila por referencia. Columnas: Código, Descripción, Categoría,
  // Costo China (último), Fecha costo China, luego por cada cliente: Precio + Margen

  // Agrupar por código
  const porCodigo = new Map()
  for (const h of historial) {
    const cod = (h.codigo_pdf || '').trim()
    if (!cod) continue
    if (!porCodigo.has(cod)) {
      porCodigo.set(cod, {
        codigo:      cod,
        descripcion: h.descripcion_pdf || '',
        categoria:   h.productos?.categorias_producto?.nombre || '',
        // Último costo China global (primer registro por fecha desc)
        costo_china: null,
        fecha_costo: null,
        // Por cliente: { clienteId: { precio, margen, fecha, proforma } }
        porCliente: {},
        // Cuántas proformas en total
        totalProformas: 0,
      })
    }
    const g = porCodigo.get(cod)

    // Costo China: guardar el más reciente (ya ordenado por fecha desc)
    if (h.precio_costo_usd && !g.costo_china) {
      g.costo_china = h.precio_costo_usd
      g.fecha_costo = h.fecha_proforma
    }

    // Precio del cliente (más reciente por cliente)
    if (h.cliente_id && h.precio_cliente_usd) {
      if (!g.porCliente[h.cliente_id]) {
        g.porCliente[h.cliente_id] = {
          precio:   h.precio_cliente_usd,
          margen:   h.margen_pct,
          fecha:    h.fecha_proforma,
          proforma: h.proforma_numero,
        }
      }
    }

    g.totalProformas++
  }

  // Encabezados hoja resumen
  const encResumen = [
    'Código', 'Descripción', 'Categoría',
    'Costo China (USD)', 'Fecha costo China',
    ...clientes.flatMap(c => [`${c.nombre} — Precio`, `${c.nombre} — Margen %`]),
    '# Proformas',
  ]

  const filasResumen = []
  for (const g of porCodigo.values()) {
    const fila = [
      g.codigo,
      g.descripcion,
      g.categoria,
      usd(g.costo_china),
      fechaLegible(g.fecha_costo),
      ...clientes.flatMap(c => {
        const pc = g.porCliente[c.id]
        return pc
          ? [usd(pc.precio), pct(pc.margen)]
          : [null, null]
      }),
      g.totalProformas,
    ]
    filasResumen.push(fila)
  }

  const wsResumen = XLSX.utils.aoa_to_sheet([encResumen, ...filasResumen])

  // Anchos de columna
  const colWidths = [
    { wch: 14 }, // Código
    { wch: 45 }, // Descripción
    { wch: 14 }, // Categoría
    { wch: 18 }, // Costo China
    { wch: 16 }, // Fecha
    ...clientes.flatMap(() => [{ wch: 20 }, { wch: 12 }]),
    { wch: 10 }, // # Proformas
  ]
  wsResumen['!cols'] = colWidths

  // Fijar primera fila (encabezado)
  wsResumen['!freeze'] = { xSplit: 0, ySplit: 1 }

  // Estilo encabezado (fila 0)
  for (let c = 0; c < encResumen.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (wsResumen[addr]) wsResumen[addr].s = estiloEncabezado()
  }

  // Estilo por categoría en las filas de datos
  filasResumen.forEach((fila, i) => {
    const cat = fila[2]
    const estilo = estiloCategoria(cat)
    // Colorear columnas A-E (código, descripción, categoría, costo, fecha)
    for (let c = 0; c <= 4; c++) {
      const addr = XLSX.utils.encode_cell({ r: i + 1, c })
      if (wsResumen[addr]) wsResumen[addr].s = estilo
    }
    // Formatear celdas de precio como número
    const colCosto = XLSX.utils.encode_cell({ r: i + 1, c: 3 })
    if (wsResumen[colCosto]?.v) wsResumen[colCosto].z = '#,##0.00'

    clientes.forEach((_, ci) => {
      const colPrecio = XLSX.utils.encode_cell({ r: i + 1, c: 5 + ci * 2 })
      const colMargen = XLSX.utils.encode_cell({ r: i + 1, c: 6 + ci * 2 })
      if (wsResumen[colPrecio]?.v) wsResumen[colPrecio].z = '#,##0.00'
      if (wsResumen[colMargen]?.v) wsResumen[colMargen].z = '0.00"%"'
    })
  })

  // 4. ── HOJA 2: HISTORIAL COMPLETO ─────────────────────────────────────────

  const encHistorial = [
    'Código', 'Descripción', 'Categoría',
    'Cliente', 'Proforma #', 'Fecha',
    'Costo China (USD)', 'Precio Cliente (USD)', 'Margen %',
  ]

  const filasHistorial = historial
    .filter(h => h.codigo_pdf?.trim())
    .map(h => [
      h.codigo_pdf?.trim(),
      h.descripcion_pdf || '',
      h.productos?.categorias_producto?.nombre || '',
      h.clientes?.nombre || '',
      h.proforma_numero || '',
      fechaLegible(h.fecha_proforma),
      usd(h.precio_costo_usd),
      usd(h.precio_cliente_usd),
      pct(h.margen_pct),
    ])

  const wsHistorial = XLSX.utils.aoa_to_sheet([encHistorial, ...filasHistorial])
  wsHistorial['!cols'] = [
    { wch: 14 }, { wch: 40 }, { wch: 14 },
    { wch: 18 }, { wch: 12 }, { wch: 12 },
    { wch: 18 }, { wch: 20 }, { wch: 10 },
  ]
  wsHistorial['!freeze'] = { xSplit: 0, ySplit: 1 }

  for (let c = 0; c < encHistorial.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (wsHistorial[addr]) wsHistorial[addr].s = estiloEncabezado()
  }

  // Formato numérico historial
  filasHistorial.forEach((_, i) => {
    const r = i + 1
    ;['F', 'G'].forEach(col => {
      const addr = `${col}${r + 1}`
      if (wsHistorial[addr]?.v) wsHistorial[addr].z = '#,##0.00'
    })
    const margenAddr = `I${r + 1}`
    if (wsHistorial[margenAddr]?.v) wsHistorial[margenAddr].z = '0.00"%"'
  })

  // 5. ── HOJA 3: COSTOS EMILY (solo entradas de costo sin precio cliente) ───

  const costosEmily = []
  const yaVisto = new Set()
  for (const h of historial) {
    const cod = (h.codigo_pdf || '').trim()
    if (!cod || yaVisto.has(cod) || !h.precio_costo_usd) continue
    yaVisto.add(cod)
    costosEmily.push([
      cod,
      h.descripcion_pdf || '',
      h.productos?.categorias_producto?.nombre || '',
      usd(h.precio_costo_usd),
      fechaLegible(h.fecha_proforma),
    ])
  }

  const encEmily = ['Código', 'Descripción', 'Categoría', 'Costo FOB China (USD)', 'Fecha último PI']
  const wsEmily = XLSX.utils.aoa_to_sheet([encEmily, ...costosEmily])
  wsEmily['!cols'] = [{ wch: 14 }, { wch: 45 }, { wch: 14 }, { wch: 20 }, { wch: 16 }]
  wsEmily['!freeze'] = { xSplit: 0, ySplit: 1 }

  for (let c = 0; c < encEmily.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (wsEmily[addr]) wsEmily[addr].s = estiloEncabezado()
  }

  costosEmily.forEach((fila, i) => {
    const cat = fila[2]
    const estilo = estiloCategoria(cat)
    for (let c = 0; c < 5; c++) {
      const addr = XLSX.utils.encode_cell({ r: i + 1, c })
      if (wsEmily[addr]) wsEmily[addr].s = estilo
    }
    const costoAddr = XLSX.utils.encode_cell({ r: i + 1, c: 3 })
    if (wsEmily[costoAddr]?.v) wsEmily[costoAddr].z = '#,##0.00'
  })

  // 6. ── HOJA 4: PENDIENTES — líneas sin costo China ────────────────────────
  // Consulta directa a proforma_lineas con precio_costo_usd = null

  const { data: lineaSSinCosto } = await supabase
    .from('proforma_lineas')
    .select(`
      codigo_pdf, descripcion_pdf, precio_cliente_usd, cantidad,
      proformas (
        numero, fecha,
        clientes ( nombre )
      )
    `)
    .is('precio_costo_usd', null)
    .not('codigo_pdf', 'is', null)
    .order('codigo_pdf', { ascending: true })

  const encPendiente = [
    'Proforma #', 'Fecha', 'Cliente',
    'Código', 'Descripción',
    'Cant.', 'Precio Cliente (USD)',
    'Costo China → completar',
  ]

  const estiloAmarillo = { fill: { fgColor: { rgb: 'FFF9C4' } }, font: { sz: 9 } }
  const estiloRojo     = { fill: { fgColor: { rgb: 'FFE0E0' } }, font: { sz: 9 } }

  const filasPendiente = (lineaSSinCosto || []).map(l => [
    l.proformas?.numero || '',
    fechaLegible(l.proformas?.fecha),
    l.proformas?.clientes?.nombre || '',
    l.codigo_pdf || '',
    l.descripcion_pdf || '',
    l.cantidad || '',
    usd(l.precio_cliente_usd),
    '',  // columna vacía para que Marta/Deisy la llene
  ])

  const wsPendiente = XLSX.utils.aoa_to_sheet([encPendiente, ...filasPendiente])
  wsPendiente['!cols'] = [
    { wch: 12 }, { wch: 11 }, { wch: 22 },
    { wch: 14 }, { wch: 42 },
    { wch: 6  }, { wch: 20 }, { wch: 22 },
  ]
  wsPendiente['!freeze'] = { xSplit: 0, ySplit: 1 }

  for (let c = 0; c < encPendiente.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (wsPendiente[addr]) wsPendiente[addr].s = estiloEncabezado()
  }

  filasPendiente.forEach((_, i) => {
    const r = i + 1
    // Filas pares → amarillo, impares → rojo suave (alternado por proforma)
    const estilo = i % 2 === 0 ? estiloAmarillo : estiloRojo
    for (let c = 0; c < encPendiente.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (wsPendiente[addr]) wsPendiente[addr].s = estilo
    }
    // Columna "Costo China → completar" resaltada diferente
    const addrCosto = XLSX.utils.encode_cell({ r, c: 7 })
    if (wsPendiente[addrCosto]) {
      wsPendiente[addrCosto].s = {
        fill: { fgColor: { rgb: 'E8F5E9' } },
        font: { sz: 9 },
        border: { bottom: { style: 'thin', color: { rgb: 'AAAAAA' } } },
      }
    }
    // Formatear precio cliente
    const addrPrecio = XLSX.utils.encode_cell({ r, c: 6 })
    if (wsPendiente[addrPrecio]?.v) wsPendiente[addrPrecio].z = '#,##0.00'
  })

  // 7. Ensamblar y guardar
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsResumen,   '📊 Resumen por Referencia')
  XLSX.utils.book_append_sheet(wb, wsEmily,     '🇨🇳 Costos Emily (Input)')
  XLSX.utils.book_append_sheet(wb, wsHistorial, '📋 Historial Completo')
  XLSX.utils.book_append_sheet(wb, wsPendiente, '⚠️ Pendientes — Sin Costo')

  const fecha = new Date().toISOString().split('T')[0]
  const salida = path.join(os.homedir(), 'Desktop', `Europartners_Precios_${fecha}.xlsx`)

  XLSX.writeFile(wb, salida, { bookSST: false, type: 'file', cellStyles: true })

  console.log(`\n✓ Excel generado: ${salida}`)
  console.log(`  📊 Resumen:     ${porCodigo.size} referencias × ${clientes.length} clientes`)
  console.log(`  🇨🇳 Emily:      ${costosEmily.length} costos FOB`)
  console.log(`  📋 Historial:   ${filasHistorial.length} registros`)
  console.log(`  ⚠️  Pendientes:  ${filasPendiente.length} líneas sin costo China`)
}

main().catch(err => { console.error('ERROR:', err); process.exit(1) })
