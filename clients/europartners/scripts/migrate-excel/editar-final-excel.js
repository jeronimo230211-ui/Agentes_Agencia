/**
 * Edita el archivo FINAL en su lugar (sin generar nuevo archivo):
 *  1. Recalcula márgenes: mayorista 15%, detallista 20% para TODOS los productos
 *  2. Corrige los 33% de detallista de Art Basins
 *  3. Agrega los productos Laundry con códigos ficticios LAUN-001...
 *
 * Uso: node editar-final-excel.js
 */
import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import os from 'os'

const FINAL = path.join(os.homedir(), 'Desktop', 'Europartners_Analisis_Catalogo_2026-07-05_FINAL.xlsx')
const LAUNDRY = 'C:/Users/Jeronimo/OneDrive/EUROPARTNERS/CHINA/THANSHAN/LISTA DE PRECIO THANSANG/LAUNDRY/PRICE LIST LAUNDRY  JERO.xlsx'

const MARGEN_MAY = 15   // %
const MARGEN_DET = 20   // %

// ── Índices de columna en la hoja "📦 Catálogo Consolidado" ──
// 0=Código 1=Nombre 2=Desc 3=Color 4=Categoría 5=Dimensiones 6=MOQ 7=CBM
// 8=FOB China USD  9=EXW RMB  10=FOB Full
// 11=%MayorMay  12=PrecioMay  13=%MargenDet  14=PrecioDet
// 15=Foto  16=Fuente  17=Notas
const C = { cat:4, fob:8, rmb:9, pMay:11, vmay:12, pDet:13, vdet:14, notas:17 }

function cel(ws, r, c) { return XLSX.utils.encode_cell({ r, c }) }

function setNum(ws, r, c, v, fmt) {
  const addr = cel(ws, r, c)
  const existing = ws[addr] || {}
  ws[addr] = { ...existing, t: 'n', v: v == null ? null : +v, z: fmt || '#,##0.00' }
}

function roundDos(n) { return Math.round(n * 100) / 100 }

// ── 1. Leer el FINAL ─────────────────────────────────────────
console.log('Leyendo:', FINAL)
const wb = XLSX.read(fs.readFileSync(FINAL), { type: 'buffer', cellStyles: true })
const hojaName = wb.SheetNames[0]
const ws = wb.Sheets[hojaName]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

console.log(`Hoja: "${hojaName}" | ${rows.length} filas totales (incluye encabezado)`)

// ── 2. Recalcular márgenes en filas existentes ────────────────
let actualizados = 0
let sinBase = 0

for (let i = 1; i < rows.length; i++) {   // i=0 es encabezado
  const r = rows[i]
  if (!r || !r[0]) continue                // fila vacía

  const categoria = String(r[C.cat] || '')
  // Base de precio: Big Basins usan RMB (col 9), el resto FOB USD (col 8)
  const esBigBasin = categoria === 'Big Basins'
  const base = esBigBasin ? (r[C.rmb] || r[C.fob]) : (r[C.fob] || r[C.rmb])

  if (!base || isNaN(base)) { sinBase++; continue }

  const nuevoMay = roundDos(base * (1 + MARGEN_MAY / 100))
  const nuevoDet = roundDos(base * (1 + MARGEN_DET / 100))

  setNum(ws, i, C.pMay, MARGEN_MAY, '0.00"%"')
  setNum(ws, i, C.vmay, nuevoMay)
  setNum(ws, i, C.pDet, MARGEN_DET, '0.00"%"')
  setNum(ws, i, C.vdet, nuevoDet)

  // Limpiar nota de "33% apilado" si ya existía
  const addrNotas = cel(ws, i, C.notas)
  if (ws[addrNotas]?.v && String(ws[addrNotas].v).includes('apilado')) {
    ws[addrNotas] = { ...ws[addrNotas], v: '', t: 's' }
  }

  actualizados++
}

console.log(`  ✓ Filas actualizadas: ${actualizados} | Sin precio base: ${sinBase}`)

// ── 3. Parsear el archivo Laundry ─────────────────────────────
const wbL  = XLSX.read(fs.readFileSync(LAUNDRY), { type: 'buffer' })
const rowsL = XLSX.utils.sheet_to_json(wbL.Sheets['Hoja1'], { header: 1, defval: null })

// Fila 0 = título, Fila 1 = encabezados, Filas 2-10 = datos
const datosLaundry = rowsL.slice(2).filter(r => r && r[0])

console.log(`\nProductos Laundry encontrados: ${datosLaundry.length}`)

// Calcular próxima fila disponible en el sheet
const ultimaFila = rows.length  // siguiente índice (0-based) = rows.length

const filasNuevas = datosLaundry.map((r, idx) => {
  const codigo    = `LAUN-${String(idx + 1).padStart(3, '0')}`
  const tamano    = String(r[0] || '').trim()
  const fob       = r[2] != null ? +r[2] : null
  const precioMay = fob != null ? roundDos(fob * 1.15) : null
  const precioDet = fob != null ? roundDos(fob * 1.20) : null

  console.log(`  ${codigo}  ${tamano.padEnd(22)}  FOB=$${fob}  May=$${precioMay}  Det=$${precioDet}`)

  return [
    codigo,           // 0 Código
    `Laundry Sink ${tamano}`,  // 1 Nombre
    `Laundry Sink ${tamano}`,  // 2 Descripción
    '',               // 3 Color
    'Laundry Sinks',  // 4 Categoría
    tamano,           // 5 Dimensiones
    '',               // 6 MOQ
    null,             // 7 CBM
    fob,              // 8 FOB China USD
    null,             // 9 EXW RMB
    null,             // 10 FOB Full
    MARGEN_MAY,       // 11 % Margen Mayorista
    precioMay,        // 12 Precio Mayorista
    MARGEN_DET,       // 13 % Margen Detallista
    precioDet,        // 14 Precio Detallista
    'No',             // 15 Tiene foto
    'PRICE LIST LAUNDRY JERO.xlsx',  // 16 Fuente
    'Código ficticio — actualizar manualmente',  // 17 Notas
  ]
})

// Escribir nuevas filas en el sheet
const estiloAmarillo = { fill: { fgColor: { rgb: 'FFF9C4' } }, font: { sz: 9 } }

filasNuevas.forEach((fila, fi) => {
  const rowIdx = ultimaFila + fi
  fila.forEach((val, ci) => {
    if (val == null) return
    const addr = cel(ws, rowIdx, ci)
    const esNumero = typeof val === 'number'
    ws[addr] = {
      t: esNumero ? 'n' : 's',
      v: val,
      s: estiloAmarillo,
      ...(esNumero && (ci === C.vmay || ci === C.vdet || ci === C.fob)
        ? { z: '#,##0.00' } : {}),
    }
  })
})

// Actualizar el rango del sheet para incluir nuevas filas
const totalFilas  = ultimaFila + filasNuevas.length
const totalCols   = 18
ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalFilas - 1, c: totalCols - 1 } })

// ── 4. Guardar en el mismo archivo ───────────────────────────
XLSX.writeFile(wb, FINAL, { bookSST: false, type: 'file', cellStyles: true })

console.log(`\n✓ Archivo actualizado en su lugar:`)
console.log(`  ${FINAL}`)
console.log(`  Productos existentes recalculados: ${actualizados}`)
console.log(`  Productos Laundry añadidos:        ${filasNuevas.length}`)
console.log(`  Total de productos en el catálogo: ${actualizados + filasNuevas.length}`)
