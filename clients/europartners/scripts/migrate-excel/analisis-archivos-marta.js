/**
 * Extrae y consolida datos de los 4 archivos de Marta en un Excel de análisis.
 * Salida: Desktop/Europartners_Analisis_Catalogo_YYYY-MM-DD.xlsx
 */
import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import os from 'os'

const BASE = 'C:/Users/Jeronimo/Desktop/Europrtners/Archivos para BD'

function parseNum(v) {
  if (v == null) return null
  if (typeof v === 'number') return Number(v.toFixed(4))
  const m = String(v).match(/[\d.]+/)
  return m ? parseFloat(m[0]) : null
}

function limpiarTexto(v) {
  if (!v) return ''
  return String(v).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
}

function enc(ws, r, c) { return XLSX.utils.encode_cell({ r, c }) }

function estiloEnc() {
  return { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
           fill: { fgColor: { rgb: '1E3A5F' } },
           alignment: { horizontal: 'center', wrapText: true } }
}

function estiloCat(cat) {
  const colores = {
    'Art Basins':     'DBEAFE',
    'Wash Basins':    'CFFAFE',
    'Big Basins':     'EDE9FE',
    'Mirrors':        'D1FAE5',
    'Rock Plate Sink':'FEF3C7',
  }
  return { fill: { fgColor: { rgb: colores[cat] || 'FFFFFF' } }, font: { sz: 9 } }
}

// ── 1. ART BASIN ─────────────────────────────────────────────
function parsearArtBasin() {
  const wb = XLSX.read(fs.readFileSync(path.join(BASE, 'ART BASIN INFORMATION (China).xlsx')), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['远威'], { header: 1, defval: null })
  const productos = []
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] || []
    const codigo = limpiarTexto(r[0])
    if (!codigo) continue
    const fob       = parseNum(r[5])
    const precioMay = parseNum(r[7])
    const precioDet = parseNum(r[9])
    const margenMay = parseNum(r[6])  // 0.13 del archivo

    // Margen detallista efectivo: calculado sobre FOB (el archivo apila 13%+20% = ×1.33)
    // Se muestra el % real respecto al FOB, no el 20% del archivo que es sobre mayorista
    const margenDetReal = (fob && precioDet) ? +((precioDet / fob - 1) * 100).toFixed(1) : null

    productos.push({
      codigo,
      nombre:            `Art Basin ${codigo}`,
      descripcion:       `Art Basin ${codigo}`,
      categoria:         'Art Basins',
      dimensiones:       limpiarTexto(r[3]),
      moq:               limpiarTexto(r[4]),
      cbm:               null,
      fob_emily:         fob,
      margen_mayorista:  margenMay ? +(margenMay * 100).toFixed(1) : null,
      precio_mayorista:  precioMay,
      margen_detallista: margenDetReal,
      precio_detallista: precioDet,
      tiene_foto:        'Sí',
      fuente:            'ART BASIN INFORMATION (China).xlsx',
      notas:             margenDetReal && margenDetReal > 25 ? `Margen detallista efectivo ${margenDetReal}% (13%+20% apilados sobre FOB)` : '',
    })
  }
  return productos
}

// ── 2. BASIN PRICE LIST ──────────────────────────────────────
// Solo tiene precio FOB China, sin precio Europartners
function parsearBasinPriceList() {
  const wb = XLSX.read(fs.readFileSync(path.join(BASE, 'BASIN PRICE LIST.xls')), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { header: 1, defval: null })
  const productos = []
  // Datos en filas 4-5 (índices)
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i] || []
    const codigo = limpiarTexto(r[0])
    if (!codigo || /^(Remark|[0-9]+[.\s])/.test(codigo)) continue
    // Precio 40HQ full container (col[7]) → más representativo
    const precio40hq = parseNum(r[7])
    const cbm = parseNum(r[4])
    productos.push({
      codigo,
      nombre: limpiarTexto(r[3]) || `Basin ${codigo}`,
      descripcion: limpiarTexto(r[3]),
      categoria: 'Wash Basins',
      dimensiones: limpiarTexto(r[2]),
      moq: null,
      cbm,
      fob_emily: precio40hq,
      margen_mayorista: null,
      precio_mayorista: null,
      margen_detallista: null,
      precio_detallista: null,
      tiene_foto: 'Sí',
      fuente: 'BASIN PRICE LIST.xls',
      notas: 'Solo FOB China — sin precio Europartners aún',
    })
  }
  return productos
}

// ── 3. BIG BASIN ─────────────────────────────────────────────
function parsearBigBasin() {
  const wb = XLSX.read(fs.readFileSync(path.join(BASE, 'BIG BASIN PRICE LIST.xlsx')), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { header: 1, defval: null })
  const productos = []
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] || []
    const codigo = limpiarTexto(r[0])
    if (!codigo) continue
    const precioChina = parseNum(r[4])   // EXW RMB — base de cálculo
    const cbm         = parseNum(r[5])
    const margenMay   = parseNum(r[8])   // 0.13 para todos
    const precioMay   = parseNum(r[9])   // ya calculado: china * 1.13

    // Detallista: el archivo solo tiene el dato para 802-60.
    // Para el resto, col[11] repite el precio China. Se aplica estándar 20%.
    const precioDet   = precioChina ? +((precioChina * 1.20).toFixed(2)) : null
    const margenDet   = 20

    productos.push({
      codigo,
      nombre:           limpiarTexto(r[3]) || `Big Basin ${codigo}`,
      descripcion:      limpiarTexto(r[3]),
      categoria:        'Big Basins',
      dimensiones:      limpiarTexto(r[2]),
      moq:              null,
      cbm,
      fob_emily:        null,
      precio_exw_rmb:   precioChina,
      margen_mayorista: margenMay ? +(margenMay * 100).toFixed(1) : null,  // 13%
      precio_mayorista: precioMay,
      margen_detallista: margenDet,
      precio_detallista: precioDet,
      tiene_foto:       'Sí',
      fuente:           'BIG BASIN PRICE LIST.xlsx',
      notas:            'Precio China en RMB (EXW)',
    })
  }
  return productos
}

// ── 4. MIRROR & ROCK PLATE ───────────────────────────────────
// China FOB Mix = col[9] (col J)  |  Europartners FOB Mix = col[12] (col M)
// col[10]: 0.2 cuando hay comisión explícita, null en variantes B (donde Euro=China en el archivo)
// Regla: si Euro=China o col[10] es null → aplicar 20% estándar sobre precio China
function parsearMirrorRock() {
  const wb = XLSX.read(fs.readFileSync(path.join(BASE, 'NEW PRICE LIST FOR MIRROR AND ROCK PLATE (JERO).xlsx')), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { header: 1, defval: null })
  const productos = []
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] || []
    const factoryRef = limpiarTexto(r[1])
    const itemName   = limpiarTexto(r[2])
    if (!factoryRef && !itemName) continue
    if (String(r[0] || '').toLowerCase().includes('power')) continue

    const categoria = factoryRef.startsWith('WD1120') && parseInt(factoryRef.slice(-2)) <= 4
      ? 'Rock Plate Sinks'
      : 'Mirrors'

    const fobChinaMix  = parseNum(r[9])   // col J — precio China FOB Mix
    const fobEuroMix   = parseNum(r[12])  // col M — precio Europartners FOB Mix (puede = China si falta margen)
    const fobChinaFull = parseNum(r[8])
    const cbm          = parseNum(r[17])

    // Mayorista: 13% estándar Europartners sobre precio China FOB Mix
    const margenMay = fobChinaMix ? 13 : null
    const precioMay = fobChinaMix ? +(fobChinaMix * 1.13).toFixed(2) : null

    // Detallista: 20% sobre precio China FOB Mix
    const margenDet = fobChinaMix ? 20 : null
    const precioDet = fobChinaMix ? +(fobChinaMix * 1.20).toFixed(2) : null

    productos.push({
      codigo:            factoryRef || itemName,
      nombre:            itemName,
      descripcion:       limpiarTexto(r[5]),
      categoria,
      color:             limpiarTexto(r[4]),
      dimensiones:       limpiarTexto(r[6]),
      moq:               null,
      cbm,
      fob_emily:         fobChinaMix,
      fob_china_full:    fobChinaFull,
      margen_mayorista:  margenMay,
      precio_mayorista:  precioMay,
      margen_detallista: margenDet,
      precio_detallista: precioDet,
      tiene_foto:        'Sí',
      fuente:            'NEW PRICE LIST FOR MIRROR AND ROCK PLATE (JERO).xlsx',
      notas:             'Precios FOB Mix container',
    })
  }
  return productos
}

// ── MAIN: generar Excel de análisis ──────────────────────────
async function main() {
  const artBasins  = parsearArtBasin()
  const bigBasins  = parsearBigBasin()
  // 801-60 y TG-600B excluidos: no van a la BD
  const mirrors    = parsearMirrorRock()

  const todos = [...artBasins, ...bigBasins, ...mirrors]

  console.log(`Art Basins:      ${artBasins.length} productos`)
  console.log(`Big Basins:      ${bigBasins.length} productos`)
  console.log(`Mirrors+Rock:    ${mirrors.length} productos`)
  console.log(`Total:           ${todos.length} productos`)

  // ── HOJA 1: CATÁLOGO CONSOLIDADO ────────────────────────────
  const enc1 = [
    'Código', 'Nombre / Descripción', 'Descripción completa', 'Color/Variante',
    'Categoría', 'Dimensiones', 'MOQ', 'CBM unitario',
    'Precio FOB China (USD)', 'Precio EXW RMB (Big Basins)',
    'Precio FOB China Full container',
    '% Margen Mayorista', 'Precio Mayorista (USD / RMB para Big Basins)',
    '% Margen Detallista', 'Precio Detallista (USD / RMB para Big Basins)',
    'Tiene foto', 'Archivo origen', 'Notas / Pendiente',
  ]

  const filas1 = todos.map(p => [
    p.codigo,
    p.nombre,
    p.descripcion,
    p.color || '',
    p.categoria,
    p.dimensiones,
    p.moq || '',
    p.cbm,
    p.fob_emily,
    p.precio_exw_rmb || null,
    p.fob_china_full || null,
    p.margen_mayorista,
    p.precio_mayorista,
    p.margen_detallista,
    p.precio_detallista,
    p.tiene_foto,
    p.fuente,
    p.notas,
  ])

  const ws1 = XLSX.utils.aoa_to_sheet([enc1, ...filas1])
  ws1['!cols'] = [
    {wch:14},{wch:30},{wch:40},{wch:20},
    {wch:14},{wch:22},{wch:10},{wch:10},
    {wch:20},{wch:16},{wch:22},
    {wch:16},{wch:20},
    {wch:16},{wch:20},
    {wch:10},{wch:38},{wch:35},
  ]
  ws1['!freeze'] = { xSplit: 0, ySplit: 1 }

  enc1.forEach((_, c) => { const a = enc(ws1, 0, c); if (ws1[a]) ws1[a].s = estiloEnc() })

  filas1.forEach((f, i) => {
    const cat = f[4]
    const s = estiloCat(cat)
    f.forEach((_, c) => { const a = enc(ws1, i+1, c); if (ws1[a]) ws1[a].s = s })
    // Formato numérico
    ;[8,9,10,12,14].forEach(c => {
      const a = enc(ws1, i+1, c); if (ws1[a]?.v) ws1[a].z = '#,##0.00'
    })
    ;[7].forEach(c => {
      const a = enc(ws1, i+1, c); if (ws1[a]?.v) ws1[a].z = '#,##0.0000'
    })
  })

  // ── HOJA 2: RESUMEN POR CATEGORÍA ───────────────────────────
  const resumenMap = {}
  for (const p of todos) {
    const cat = p.categoria
    if (!resumenMap[cat]) resumenMap[cat] = { cat, total: 0, conFob: 0, conMay: 0, conDet: 0, conFoto: 0 }
    resumenMap[cat].total++
    if (p.fob_emily) resumenMap[cat].conFob++
    if (p.precio_mayorista) resumenMap[cat].conMay++
    if (p.precio_detallista) resumenMap[cat].conDet++
    if (p.tiene_foto === 'Sí') resumenMap[cat].conFoto++
  }

  const enc2 = ['Categoría','# Productos','Con FOB China','Con Precio Mayorista','Con Precio Detallista','Con Foto','% Cobertura precio']
  const filas2 = Object.values(resumenMap).map(r => [
    r.cat, r.total, r.conFob, r.conMay, r.conDet, r.conFoto,
    +((Math.max(r.conMay, r.conFob) / r.total) * 100).toFixed(0) + '%',
  ])

  const ws2 = XLSX.utils.aoa_to_sheet([enc2, ...filas2])
  ws2['!cols'] = [{wch:18},{wch:13},{wch:13},{wch:20},{wch:20},{wch:10},{wch:18}]
  ws2['!freeze'] = { xSplit: 0, ySplit: 1 }
  enc2.forEach((_, c) => { const a = enc(ws2, 0, c); if (ws2[a]) ws2[a].s = estiloEnc() })
  filas2.forEach((f, i) => {
    const s = estiloCat(f[0])
    f.forEach((_, c) => { const a = enc(ws2, i+1, c); if (ws2[a]) ws2[a].s = s })
  })

  // ── HOJA 3: PENDIENTES / PREGUNTAS ──────────────────────────
  const pendientes = [
    ['#', 'Tema', 'Detalle', 'Estado / Acción'],
    [1, 'Big Basins — precio en RMB', '11 productos con precio EXW RMB (no USD FOB)', 'Incluidos en BD — precio RMB es el precio correcto de Europartners para este grupo'],
    [2, 'Segmentación mayorista/detallista', 'Queda a nivel de cliente en el sistema, no en el producto', 'Resuelto — se configura por cliente en la app'],
    [3, 'Cliente con SKU propio', 'Un cliente maneja sus propios códigos de referencia', 'Pendiente — Marta enviará la base de datos de SKU del cliente'],
    [4, 'Imágenes', 'Fotos embebidas en los Excel — se pueden extraer con script', 'Pendiente — extraer en próxima sesión por código de producto'],
    [5, 'Wash Basins 801-60 / TG-600B', 'Solicitud particular — no aplican para el catálogo general', 'Excluidos de la BD'],
  ]

  const enc3 = pendientes[0]
  const filas3 = pendientes.slice(1)
  const ws3 = XLSX.utils.aoa_to_sheet([enc3, ...filas3])
  ws3['!cols'] = [{wch:4},{wch:28},{wch:55},{wch:55}]
  ws3['!freeze'] = { xSplit: 0, ySplit: 1 }
  enc3.forEach((_, c) => { const a = enc(ws3, 0, c); if (ws3[a]) ws3[a].s = estiloEnc() })
  const sAm = { fill: { fgColor: { rgb: 'FFF9C4' } }, font: { sz: 9 } }
  filas3.forEach((_, i) => filas3[i].forEach((__, c) => { const a = enc(ws3, i+1, c); if (ws3[a]) ws3[a].s = sAm }))

  // ── ENSAMBLAR ────────────────────────────────────────────────
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, '📦 Catálogo Consolidado')
  XLSX.utils.book_append_sheet(wb, ws2, '📊 Resumen por Categoría')
  XLSX.utils.book_append_sheet(wb, ws3, '❓ Pendientes')

  const hoy = new Date().toISOString().split('T')[0]
  const salida = path.join(os.homedir(), 'Desktop', `Europartners_Analisis_Catalogo_${hoy}_FINAL.xlsx`)
  XLSX.writeFile(wb, salida, { bookSST: false, type: 'file', cellStyles: true })

  console.log(`\n✓ Excel generado: ${salida}`)
  console.log(`  Hoja 1 — Catálogo: ${todos.length} productos`)
  console.log(`  Hoja 2 — Resumen por categoría`)
  console.log(`  Hoja 3 — Pendientes y preguntas (${pendientes.length - 1} ítems)`)
}

main().catch(e => { console.error(e); process.exit(1) })
