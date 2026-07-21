/**
 * Carga 3 listas de precios nuevas al archivo FINAL:
 *  1. Cabinas de ducha y bañeras -> categorías "Shower Enclosures" + "Bathtubs"
 *  2. Inodoros wash-down one/two-piece -> categoría nueva "Wash Down Toilets"
 *  3. Protectores de voltaje -> categoría nueva "Voltage Protectors"
 *
 * También extrae las imágenes embebidas de cada Excel origen y las guarda en
 * OneDrive/Europartners_Imagenes/{categoria}/{codigo}.{ext}
 *
 * Margen aplicado (decisión Jero 2026-07-20): 12% Mayorista / 18% Detallista,
 * igual al margen que ya tiene el catálogo FINAL vivo hoy (NO el 15/20 de la
 * reunión de precios, que quedó desactualizado por corrección manual).
 *
 * Uso: node cargar-cabinas-toilets-voltage.js [--write]
 *   Sin --write: solo imprime preview, no toca ningún archivo.
 *   Con --write: escribe el FINAL + extrae imágenes.
 */
import XLSX from 'xlsx'
import AdmZip from 'adm-zip'
import fs from 'fs'
import path from 'path'

const WRITE = process.argv.includes('--write')

const FINAL = 'C:/Users/Jeronimo/OneDrive/Documentos/BD_Catalogo_EUP/Europartners_Analisis_Catalogo_2026-07-05_FINAL (1) (1).xlsx'
const IMG_BASE = 'C:/Users/Jeronimo/OneDrive/Europartners_Imagenes'

const CABINAS_FILE = 'C:/Users/Jeronimo/OneDrive/EUROPARTNERS/CHINA/THANSHAN/LISTA DE PRECIO THANSANG/precios cabinas de ducha y bañeras (JERO).xlsx'
const TOILET_FILE_XLSX = 'C:/Users/Jeronimo/AppData/Local/Temp/claude/C--WINDOWS-System32/2f954fee-7ed3-4b05-8a59-87eeae3fe416/scratchpad/WASH DOWN P-TRAP TOILET(2026.7.17)one piece.GERO.xlsx'
const TOILET_FILE_ORIGINAL_NAME = 'WASH DOWN P-TRAP TOILET(2026.7.17)one piece.GERO.xls'
const VOLTAGE_FILE = 'C:/Users/Jeronimo/OneDrive/EUROPARTNERS/CHINA/THANSHAN/LISTA DE PRECIO THANSANG/PROTECTORES DE VOLTAGE/QUOTATION-Voltage Protector(2027.7.17)GERO.xlsx'

const MARGEN_MAY = 0.12
const MARGEN_DET = 0.18

function roundDos(n) { return Math.round(n * 100) / 100 }

function limpiarTexto(v) {
  return String(v || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function limpiarCodigo(v) {
  return String(v || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function limpiarDimension(v) {
  return String(v || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function slugCodigo(v) {
  return limpiarCodigo(v).toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9\-]/g, '')
}

function parsePrecio(v) {
  if (v == null) return null
  if (typeof v === 'number') return v
  // formato raro "$58,15" -> 58.15
  const s = String(v).replace('$', '').trim()
  if (s.includes(',') && !s.includes('.')) return parseFloat(s.replace(',', '.'))
  return parseFloat(s.replace(/,/g, ''))
}

// ── Parseo de imágenes embebidas (drawing1.xml + rels) ─────────
function parseAnchors(xmlStr) {
  const anchors = []
  const anchorReg = /<xdr:(?:one|two)CellAnchor[\s\S]*?<\/xdr:(?:one|two)CellAnchor>/g
  const bloques = xmlStr.match(anchorReg) || []
  for (const bloque of bloques) {
    const filaM = bloque.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/)
    const colM = bloque.match(/<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>/)
    const ridM = bloque.match(/r:embed="(rId\d+)"/)
    if (filaM && ridM) anchors.push({ rId: ridM[1], fila: +filaM[1], col: colM ? +colM[1] : null })
  }
  return anchors
}
function parseRels(relsStr) {
  const map = {}
  const reg = /Id="(rId\d+)"[^>]*Target="\.\.\/media\/([^"]+)"/g
  let m
  while ((m = reg.exec(relsStr)) !== null) map[m[1]] = m[2]
  return map
}

function cargarZip(archivo) {
  const zip = new AdmZip(archivo)
  const drawingXml = zip.readAsText('xl/drawings/drawing1.xml')
  const relsXml = zip.readAsText('xl/drawings/_rels/drawing1.xml.rels')
  const anchors = parseAnchors(drawingXml)
  const rIdMap = parseRels(relsXml)
  return { zip, anchors, rIdMap }
}

// Devuelve lista de {fila, archivoMedia} para una columna dada, agrupando múltiples imágenes por fila
function imagenesPorFila(anchors, rIdMap, colFiltro) {
  const mapa = {}
  for (const a of anchors) {
    if (colFiltro != null && a.col !== colFiltro) continue
    const archivo = rIdMap[a.rId]
    if (!archivo) continue
    if (!mapa[a.fila]) mapa[a.fila] = []
    if (!mapa[a.fila].includes(archivo)) mapa[a.fila].push(archivo)
  }
  return mapa
}

function guardarImagenes(zip, archivos, carpeta, codigo) {
  if (!archivos || archivos.length === 0) return { guardadas: 0, exts: [] }
  fs.mkdirSync(carpeta, { recursive: true })
  let n = 0
  const exts = []
  archivos.forEach((archivoMedia, idx) => {
    const ext = path.extname(archivoMedia)
    const nombreDestino = idx === 0 ? `${codigo}${ext}` : `${codigo}_${idx + 1}${ext}`
    const destino = path.join(carpeta, nombreDestino)
    if (WRITE) {
      const data = zip.readFile(`xl/media/${archivoMedia}`)
      fs.writeFileSync(destino, data)
    }
    n++
    exts.push(nombreDestino)
  })
  return { guardadas: n, exts }
}

// ════════════════════════════════════════════════════════════════
// 1. CABINAS DE DUCHA Y BAÑERAS
// ════════════════════════════════════════════════════════════════
function procesarCabinas() {
  const wb = XLSX.read(fs.readFileSync(CABINAS_FILE), { type: 'buffer' })
  const ws = wb.Sheets['Sheet2']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  const { zip, anchors, rIdMap } = cargarZip(CABINAS_FILE)
  const imgPorFila = imagenesPorFila(anchors, rIdMap, 1) // columna "Picture" = índice 1

  const contadorModelo = {}
  let currentModelRaw = null
  let currentDescRaw = null

  const productos = []

  for (let fila = 1; fila < rows.length; fila++) {
    const r = rows[fila]
    if (!r || r.every(v => v == null)) continue // fila totalmente vacía (ej. fila 40)

    const modelRaw = r[3]
    const descRaw = r[5]
    if (modelRaw) currentModelRaw = modelRaw
    if (descRaw) currentDescRaw = descRaw

    const modelClean = limpiarCodigo(currentModelRaw)
    const modelSlug = slugCodigo(currentModelRaw)
    contadorModelo[modelSlug] = (contadorModelo[modelSlug] || 0) + 1
    const sufijo = String(contadorModelo[modelSlug]).padStart(2, '0')
    const codigo = `${modelSlug}-${sufijo}`

    const size = limpiarDimension(r[4])
    const fobFull = r[6] != null ? +r[6] : null
    const fobCombined = r[9] != null ? +r[9] : null
    const moq = r[12] != null ? +r[12] : null
    const cbm = r[14] != null ? +r[14] : null
    const gw = r[15] != null ? +r[15] : null

    const fobBase = fobCombined != null ? fobCombined : fobFull
    const precioMay = fobBase != null ? roundDos(fobBase * (1 + MARGEN_MAY)) : null
    const precioDet = fobBase != null ? roundDos(fobBase * (1 + MARGEN_DET)) : null

    const categoria = fila <= 23 ? 'Shower Enclosures' : 'Bathtubs'
    const tipoNombre = fila <= 23 ? 'Shower Enclosure' : 'Bathtub'

    // color heurístico
    const textoBusqueda = `${currentModelRaw} ${currentDescRaw}`.toLowerCase()
    let color = null
    if (textoBusqueda.includes('chrome')) color = 'Chrome'
    else if (textoBusqueda.includes('black') || textoBusqueda.includes('biack')) color = 'Black'
    else if (textoBusqueda.includes('silver')) color = 'Silver'
    else if (textoBusqueda.includes('dark grey') || textoBusqueda.includes('grey')) color = 'Dark Grey Glass'
    else if (textoBusqueda.includes('white')) color = 'White'

    const imagenesFila = imgPorFila[fila] || []
    const tieneFoto = imagenesFila.length > 0

    const notasPartes = []
    notasPartes.push(`Model No. proveedor: "${modelClean}"`)
    if (!descRaw) notasPartes.push('Fila continuación de tamaño/color del modelo anterior (sin descripción propia)')
    if (!tieneFoto) notasPartes.push('Sin foto propia extraída del archivo origen')
    if (gw != null) notasPartes.push(`Peso bruto unitario: ${gw} KGS`)
    notasPartes.push(`FOB full container: $${fobFull} | FOB combined container: $${fobCombined} (usado como base)`)
    if (/biack/i.test(modelClean)) notasPartes.push('Posible typo del proveedor en Model No. ("BIACK" en vez de "BLACK")')

    productos.push({
      codigo,
      nombre: `${tipoNombre} ${modelClean}`,
      descripcion: limpiarTexto(currentDescRaw),
      color,
      categoria,
      dimensiones: size,
      moq,
      cbm,
      fob: fobBase,
      fobFull,
      margenMay: MARGEN_MAY,
      precioMay,
      margenDet: MARGEN_DET,
      precioDet,
      tieneFoto: tieneFoto ? 'Sí' : 'No',
      archivoOrigen: path.basename(CABINAS_FILE),
      notas: notasPartes.join(' | '),
      _imgCarpeta: categoria,
      _imgArchivos: imagenesFila,
      _zip: zip,
    })
  }

  return productos
}

// ════════════════════════════════════════════════════════════════
// 2. WASH DOWN TOILETS
// ════════════════════════════════════════════════════════════════
function procesarToilets() {
  const wb = XLSX.read(fs.readFileSync(TOILET_FILE_XLSX), { type: 'buffer' })
  const ws = wb.Sheets['Sheet1']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  const { zip, anchors, rIdMap } = cargarZip(TOILET_FILE_XLSX)
  const imgPorFila = imagenesPorFila(anchors, rIdMap, 5) // columna "PICTURE&DRAWING" = índice 5

  const productos = []

  for (let fila = 1; fila < rows.length; fila++) {
    const r = rows[fila]
    if (!r || !r[0]) continue // filas vacías al final

    const codigo = limpiarCodigo(r[0])
    const descRaw = r[1]
    const color = r[2] ? limpiarCodigo(r[2]) : null
    const flush = r[3] ? limpiarDimension(r[3]) : null
    const size = r[4] ? limpiarDimension(r[4]) : null
    const fob = parsePrecio(r[6])

    const precioMay = fob != null ? roundDos(fob * (1 + MARGEN_MAY)) : null
    const precioDet = fob != null ? roundDos(fob * (1 + MARGEN_DET)) : null

    const descLimpia = limpiarTexto(descRaw)
    const tipoPieza = /two-piece/i.test(descLimpia) ? 'Two-Piece' : /one-piece/i.test(descLimpia) ? 'One-Piece' : ''

    const imagenesFila = imgPorFila[fila] || []
    const tieneFoto = imagenesFila.length > 0

    const notasPartes = []
    if (flush) notasPartes.push(`Flush: ${flush}`)
    notasPartes.push('Incluye: flush kits, PP slow down seat cover, 5 layers brown cartons')
    if (imagenesFila.length > 1) notasPartes.push(`${imagenesFila.length} imágenes extraídas (foto + plano)`)

    productos.push({
      codigo,
      nombre: `${tipoPieza} Wash Down Toilet ${codigo}`.trim(),
      descripcion: descLimpia,
      color,
      categoria: 'Wash Down Toilets',
      dimensiones: size,
      moq: null,
      cbm: null,
      fob,
      fobFull: null,
      margenMay: MARGEN_MAY,
      precioMay,
      margenDet: MARGEN_DET,
      precioDet,
      tieneFoto: tieneFoto ? 'Sí' : 'No',
      archivoOrigen: TOILET_FILE_ORIGINAL_NAME,
      notas: notasPartes.join(' | '),
      _imgCarpeta: 'Wash Down Toilets',
      _imgArchivos: imagenesFila,
      _zip: zip,
    })
  }

  return productos
}

// ════════════════════════════════════════════════════════════════
// 3. VOLTAGE PROTECTORS
// ════════════════════════════════════════════════════════════════
function procesarVoltage() {
  const wb = XLSX.read(fs.readFileSync(VOLTAGE_FILE), { type: 'buffer' })
  const ws = wb.Sheets['Sheet1']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  const { zip, anchors, rIdMap } = cargarZip(VOLTAGE_FILE)
  const imgPorFila = imagenesPorFila(anchors, rIdMap, 0) // columna "PICTURE" = índice 0

  // Caso especial: fila 13 (X1-19) usa DISPIMG/cellimages.xml en vez de drawing anchor normal
  const entries = zip.getEntries().map(e => e.entryName)
  if (entries.includes('xl/cellimages.xml')) {
    const cellImagesXml = zip.readAsText('xl/cellimages.xml')
    const cellRelsXml = zip.readAsText('xl/_rels/cellimages.xml.rels')
    const relMap = {}
    const reg = /Id="(rId\d+)"[^>]*Target="media\/([^"]+)"/g
    let m
    while ((m = reg.exec(cellRelsXml)) !== null) relMap[m[1]] = m[2]
    const embedM = cellImagesXml.match(/<a:blip r:embed="(rId\d+)"/)
    if (embedM && relMap[embedM[1]]) {
      // Buscar en qué fila está la fórmula DISPIMG
      for (let fila = 0; fila < rows.length; fila++) {
        const r = rows[fila]
        if (r && r[0] && String(r[0]).includes('DISPIMG')) {
          imgPorFila[fila] = [relMap[embedM[1]]]
        }
      }
    }
  }

  const productos = []

  for (let fila = 2; fila < rows.length; fila++) {
    const r = rows[fila]
    if (!r || !r[1]) continue

    const codigo = limpiarCodigo(r[1])
    const descRaw = r[2]
    const specRaw = r[3]
    const packageRaw = r[4]
    const fob = parsePrecio(r[5])
    const cartonSize = r[6] ? limpiarDimension(r[6]) : null

    const precioMay = fob != null ? roundDos(fob * (1 + MARGEN_MAY)) : null
    const precioDet = fob != null ? roundDos(fob * (1 + MARGEN_DET)) : null

    const imagenesFila = imgPorFila[fila] || []
    const tieneFoto = imagenesFila.length > 0

    const notasPartes = []
    if (packageRaw) notasPartes.push(`Empaque: ${limpiarTexto(packageRaw).replace(/\n/g, ' ')}`)

    productos.push({
      codigo,
      nombre: limpiarTexto(descRaw).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
      descripcion: limpiarTexto(specRaw),
      color: null,
      categoria: 'Voltage Protectors',
      dimensiones: cartonSize,
      moq: null,
      cbm: null,
      fob,
      fobFull: null,
      margenMay: MARGEN_MAY,
      precioMay,
      margenDet: MARGEN_DET,
      precioDet,
      tieneFoto: tieneFoto ? 'Sí' : 'No',
      archivoOrigen: path.basename(VOLTAGE_FILE),
      notas: notasPartes.join(' | '),
      _imgCarpeta: 'Voltage Protectors',
      _imgArchivos: imagenesFila,
      _zip: zip,
    })
  }

  return productos
}

// ════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════
function cel(ws, r, c) { return XLSX.utils.encode_cell({ r, c }) }

async function main() {
  console.log(WRITE ? '🔴 MODO ESCRITURA — se modificará el FINAL y se extraerán imágenes\n' : '🟡 DRY RUN — solo preview, nada se escribe (usa --write para aplicar)\n')

  const cabinas = procesarCabinas()
  const toilets = procesarToilets()
  const voltage = procesarVoltage()
  const todos = [...cabinas, ...toilets, ...voltage]

  console.log(`Cabinas/Bañeras: ${cabinas.length} productos (${cabinas.filter(p=>p.tieneFoto==='Sí').length} con foto)`)
  console.log(`Wash Down Toilets: ${toilets.length} productos (${toilets.filter(p=>p.tieneFoto==='Sí').length} con foto)`)
  console.log(`Voltage Protectors: ${voltage.length} productos (${voltage.filter(p=>p.tieneFoto==='Sí').length} con foto)`)
  console.log(`TOTAL: ${todos.length} productos nuevos\n`)

  console.log('── Preview completo ──')
  for (const p of todos) {
    console.log(`[${p.categoria}] ${p.codigo} | ${p.nombre} | FOB=$${p.fob} May=$${p.precioMay} Det=$${p.precioDet} | Foto=${p.tieneFoto} | imgs=${JSON.stringify(p._imgArchivos)}`)
  }

  // ── Duplicados de código dentro del mismo lote ──
  const conteoCod = {}
  for (const p of todos) conteoCod[p.codigo] = (conteoCod[p.codigo] || 0) + 1
  const dups = Object.entries(conteoCod).filter(([,n]) => n > 1)
  if (dups.length) {
    console.log('\n⚠️  CÓDIGOS DUPLICADOS DENTRO DEL LOTE NUEVO:', dups)
  }

  // ── Cargar FINAL para detectar códigos que ya existen (siempre, incluso en dry run) ──
  const wbFinal = XLSX.read(fs.readFileSync(FINAL), { type: 'buffer', cellStyles: true })
  const sheetName = wbFinal.SheetNames[0]
  const wsFinal = wbFinal.Sheets[sheetName]
  const rowsFinal = XLSX.utils.sheet_to_json(wsFinal, { header: 1, defval: null })

  const filaPorCodigo = new Map()
  for (let i = 1; i < rowsFinal.length; i++) {
    if (rowsFinal[i] && rowsFinal[i][0]) filaPorCodigo.set(String(rowsFinal[i][0]).trim().toUpperCase(), i)
  }

  const nuevos = todos.filter(p => !filaPorCodigo.has(p.codigo.toUpperCase()))
  const existentes = todos.filter(p => filaPorCodigo.has(p.codigo.toUpperCase()))

  if (existentes.length) {
    console.log('\n⚠️  Códigos que YA EXISTEN en el FINAL (no se duplican; si falta la foto, se completa en la fila existente):')
    existentes.forEach(p => {
      const filaIdx = filaPorCodigo.get(p.codigo.toUpperCase())
      const rowActual = rowsFinal[filaIdx]
      console.log(`   ${p.codigo} (fila ${filaIdx}, categoría actual "${rowActual[4]}", Tiene foto actual "${rowActual[15]}", fotos nuevas disponibles: ${p._imgArchivos.length})`)
    })
  } else {
    console.log('\n✓ Ningún código del lote nuevo choca con códigos existentes en el FINAL')
  }

  // ── Extraer imágenes ──
  console.log('\n── Imágenes ──')
  let totalImgOk = 0
  for (const p of nuevos) {
    const carpeta = path.join(IMG_BASE, p._imgCarpeta)
    const { guardadas, exts } = guardarImagenes(p._zip, p._imgArchivos, carpeta, p.codigo)
    totalImgOk += guardadas
    if (guardadas > 0) console.log(`  ${WRITE ? '✓' : '(preview)'} ${p.codigo} → ${exts.join(', ')}`)
  }
  // Para códigos existentes: extraer foto usando la categoría YA registrada en el FINAL (no la nuestra)
  for (const p of existentes) {
    const filaIdx = filaPorCodigo.get(p.codigo.toUpperCase())
    const categoriaActual = rowsFinal[filaIdx][4] || p._imgCarpeta
    const carpeta = path.join(IMG_BASE, categoriaActual)
    const { guardadas, exts } = guardarImagenes(p._zip, p._imgArchivos, carpeta, p.codigo)
    totalImgOk += guardadas
    if (guardadas > 0) console.log(`  ${WRITE ? '✓' : '(preview)'} [existente] ${p.codigo} → ${exts.join(', ')} (carpeta: ${categoriaActual})`)
  }
  console.log(`Total imágenes ${WRITE ? 'guardadas' : 'a guardar'}: ${totalImgOk}`)

  if (!WRITE) {
    console.log('\nDry run completo. Revisa el preview arriba. Si está correcto, corre:\n  node cargar-cabinas-toilets-voltage.js --write')
    return
  }

  // ── Actualizar "Tiene foto" de productos existentes que ahora sí tienen imagen ──
  for (const p of existentes) {
    if (p._imgArchivos.length === 0) continue
    const filaIdx = filaPorCodigo.get(p.codigo.toUpperCase())
    if (String(rowsFinal[filaIdx][15]).trim().toLowerCase() !== 'sí') {
      const addr = cel(wsFinal, filaIdx, 15)
      wsFinal[addr] = { t: 's', v: 'Sí' }
      console.log(`  ✓ ${p.codigo}: "Tiene foto" actualizado a "Sí" (fila ${filaIdx})`)
    }
  }

  let filaSiguiente = rowsFinal.length
  const totalCols = 18

  for (const p of nuevos) {
    const valores = [
      p.codigo, p.nombre, p.descripcion, p.color, p.categoria, p.dimensiones,
      p.moq, p.cbm, p.fob, null, p.fobFull, p.margenMay, p.precioMay,
      p.margenDet, p.precioDet, p.tieneFoto, p.archivoOrigen, p.notas,
    ]

    valores.forEach((val, ci) => {
      if (val == null) return
      const addr = cel(wsFinal, filaSiguiente, ci)
      const esNumero = typeof val === 'number'
      wsFinal[addr] = {
        t: esNumero ? 'n' : 's',
        v: val,
        ...(esNumero && [8,10,12,14].includes(ci) ? { z: '#,##0.00' } : {}),
        ...(esNumero && ci === 11 || ci === 13 ? { z: '0.00"%"' } : {}),
      }
    })
    filaSiguiente++
  }

  const totalFilas = filaSiguiente
  wsFinal['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalFilas - 1, c: totalCols - 1 } })

  XLSX.writeFile(wbFinal, FINAL, { bookSST: false, type: 'file', cellStyles: true })

  console.log(`\n✓ FINAL actualizado: ${FINAL}`)
  console.log(`  Productos nuevos agregados: ${nuevos.length}`)
  console.log(`  Productos ya existentes (solo foto actualizada, no duplicados): ${existentes.length}`)
  console.log(`  Total productos en catálogo ahora: ${filaSiguiente - 1}`)
}

main().catch(e => { console.error(e); process.exit(1) })
