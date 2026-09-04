/**
 * Carga 5 productos nuevos "Mirror Cabinet" (gabinetes de baño con espejo
 * integrado) desde el Excel del proveedor Thansang al FINAL consolidado,
 * bajo una categoría NUEVA "Mirror Cabinets" (decisión Jero 2026-09-03: no
 * reusar "Cabinets" ni "Mirrors", que son productos distintos).
 *
 * Margen: usa el 15%/20% que YA trae el Excel del proveedor en las columnas
 * "precio mayorista" / "Precio detallista" (decisión Jero 2026-09-03) — NO
 * se recalcula desde el FOB con la fórmula estándar del resto de scripts.
 *
 * También extrae las 5 imágenes embebidas y las guarda en
 * OneDrive/Europartners_BD/Europartners_Imagenes/Mirror Cabinets/{codigo}.ext
 *
 * Uso: node cargar-mirror-cabinets.js [--write]
 *   Sin --write: solo imprime preview, no toca ningún archivo.
 *   Con --write: escribe el FINAL + extrae imágenes.
 */
import XLSX from 'xlsx'
import AdmZip from 'adm-zip'
import fs from 'fs'
import path from 'path'

const WRITE = process.argv.includes('--write')

const FINAL = 'C:/Users/Jeronimo/OneDrive/Europartners_BD/BD_Catalogo_EUP/Europartners_Analisis_Catalogo_2026-07-05_FINAL (1) (1).xlsx'
const IMG_BASE = 'C:/Users/Jeronimo/OneDrive/Europartners_BD/Europartners_Imagenes'
const SOURCE_FILE = 'C:/Users/Jeronimo/OneDrive/EUROPARTNERS/CHINA/THANSHAN/LISTA DE PRECIO THANSANG/MIRROR CABINET Designer Jero.xlsx'
const SOURCE_NAME = 'MIRROR CABINET Designer Jero.xlsx'

const CATEGORIA = 'Mirror Cabinets'
const MARGEN_MAY = 0.15
const MARGEN_DET = 0.20

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

// ── Parseo de dimensiones (dos sub-piezas: main cabinet + mirror cabinet) ──
const DIM_MAIN_RE = /main\s*cabinet\s*[:：]\s*(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)/i
const DIM_MIRROR_RE = /mirror\s*cabinet\s*[:：]\s*(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)/i
const COLOR_RE = /Color\s*:\s*([^\r\n]+)/i

function parseDimsDobles(desc) {
  const mMain = desc.match(DIM_MAIN_RE)
  const mMirror = desc.match(DIM_MIRROR_RE)
  const main = mMain ? { largo_mm: +mMain[1], ancho_mm: +mMain[2], alto_mm: +mMain[3] } : null
  const mirror = mMirror ? { largo_mm: +mMirror[1], ancho_mm: +mMirror[2], alto_mm: +mMirror[3] } : null
  return { main, mirror }
}

// ════════════════════════════════════════════════════════════════
function procesarMirrorCabinets() {
  const wb = XLSX.read(fs.readFileSync(SOURCE_FILE), { type: 'buffer' })
  const ws = wb.Sheets['Sheet1']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  const { zip, anchors, rIdMap } = cargarZip(SOURCE_FILE)
  const imgPorFila = imagenesPorFila(anchors, rIdMap, 0) // columna PICTURE = índice 0

  const productos = []

  for (let fila = 2; fila < rows.length; fila++) {
    const r = rows[fila]
    if (!r || !r[1]) continue // fila vacía (sin FACTORY ITEM NO.)

    const codigo = limpiarCodigo(r[1])
    const descRaw = String(r[2] || '')
    const descLimpia = limpiarTexto(descRaw)
    const cbm = r[3] != null ? +r[3] : null
    const fob = r[4] != null ? +r[4] : null
    const precioMay = r[5] != null ? +r[5] : null
    const precioDet = r[6] != null ? +r[6] : null

    const colorM = descRaw.match(COLOR_RE)
    const color = colorM ? colorM[1].trim() : null

    const { main, mirror } = parseDimsDobles(descRaw)
    const dimTexto = [
      main ? `Main: ${main.largo_mm}*${main.ancho_mm}*${main.alto_mm}` : null,
      mirror ? `Mirror: ${mirror.largo_mm}*${mirror.ancho_mm}*${mirror.alto_mm}` : null,
    ].filter(Boolean).join(' | ') || null

    const imagenesFila = imgPorFila[fila] || []
    const tieneFoto = imagenesFila.length > 0

    const notasPartes = []
    notasPartes.push('Margen 15%/20% tal cual columnas "precio mayorista"/"Precio detallista" del proveedor (decisión Jero 2026-09-03, NO recalculado con la fórmula estándar del resto del catálogo)')
    if (!main || !mirror) notasPartes.push('⚠️ No se pudieron parsear ambas dimensiones (main cabinet / mirror cabinet) de la descripción')
    if (!tieneFoto) notasPartes.push('Sin foto propia extraída del archivo origen')

    productos.push({
      codigo,
      nombre: `Mirror Cabinet${color ? ' — ' + color : ''} (${codigo})`,
      descripcion: descLimpia,
      color,
      categoria: CATEGORIA,
      dimensiones: dimTexto,
      dimensionesJson: (main || mirror) ? { main_cabinet_mm: main, mirror_cabinet_mm: mirror } : null,
      moq: null,
      cbm,
      fob,
      precioMay,
      margenMay: MARGEN_MAY,
      precioDet,
      margenDet: MARGEN_DET,
      tieneFoto: tieneFoto ? 'Sí' : 'No',
      archivoOrigen: SOURCE_NAME,
      notas: notasPartes.join(' | '),
      _imgCarpeta: CATEGORIA,
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

  const productos = procesarMirrorCabinets()

  console.log(`Mirror Cabinets: ${productos.length} productos (${productos.filter(p => p.tieneFoto === 'Sí').length} con foto)\n`)

  console.log('── Preview completo ──')
  for (const p of productos) {
    console.log(`[${p.categoria}] ${p.codigo} | ${p.nombre}`)
    console.log(`   CBM=${p.cbm} FOB=$${p.fob} May=$${p.precioMay} (${p.margenMay * 100}%) Det=$${p.precioDet} (${p.margenDet * 100}%)`)
    console.log(`   Dimensiones: ${p.dimensiones}`)
    console.log(`   Color: ${p.color} | Foto=${p.tieneFoto} | imgs=${JSON.stringify(p._imgArchivos)}`)
    console.log(`   Descripción: ${p.descripcion.replace(/\n/g, ' / ')}`)
    console.log('')
  }

  // ── Duplicados dentro del lote ──
  const conteoCod = {}
  for (const p of productos) conteoCod[p.codigo] = (conteoCod[p.codigo] || 0) + 1
  const dups = Object.entries(conteoCod).filter(([, n]) => n > 1)
  if (dups.length) console.log('⚠️  CÓDIGOS DUPLICADOS DENTRO DEL LOTE:', dups)

  // ── Cargar FINAL para detectar códigos que ya existen ──
  const wbFinal = XLSX.read(fs.readFileSync(FINAL), { type: 'buffer', cellStyles: true })
  const sheetName = wbFinal.SheetNames[0]
  const wsFinal = wbFinal.Sheets[sheetName]
  const rowsFinal = XLSX.utils.sheet_to_json(wsFinal, { header: 1, defval: null })

  const filaPorCodigo = new Map()
  for (let i = 1; i < rowsFinal.length; i++) {
    if (rowsFinal[i] && rowsFinal[i][0]) filaPorCodigo.set(String(rowsFinal[i][0]).trim().toUpperCase(), i)
  }

  const nuevos = productos.filter(p => !filaPorCodigo.has(p.codigo.toUpperCase()))
  const existentes = productos.filter(p => filaPorCodigo.has(p.codigo.toUpperCase()))

  if (existentes.length) {
    console.log('\n⚠️  Códigos que YA EXISTEN en el FINAL (no se tocan):')
    existentes.forEach(p => console.log(`   ${p.codigo} (fila ${filaPorCodigo.get(p.codigo.toUpperCase())})`))
  } else {
    console.log('\n✓ Ningún código del lote choca con códigos existentes en el FINAL')
  }

  // ── Extraer imágenes ──
  console.log('\n── Imágenes ──')
  let totalImgOk = 0
  for (const p of nuevos) {
    const carpeta = path.join(IMG_BASE, p._imgCarpeta)
    const { guardadas, exts } = guardarImagenes(p._zip, p._imgArchivos, carpeta, p.codigo)
    totalImgOk += guardadas
    if (guardadas > 0) console.log(`  ${WRITE ? '✓' : '(preview)'} ${p.codigo} → ${exts.join(', ')} (carpeta: ${p._imgCarpeta})`)
  }
  console.log(`Total imágenes ${WRITE ? 'guardadas' : 'a guardar'}: ${totalImgOk}`)

  if (!WRITE) {
    console.log('\nDry run completo. Revisa el preview arriba. Si está correcto, corre:\n  node cargar-mirror-cabinets.js --write')
    return
  }

  if (existentes.length) {
    console.log('\n⚠️  Hay códigos ya existentes en el FINAL — no se escribe nada para evitar duplicados/sobrescritura no solicitada. Revisar manualmente.')
    return
  }

  let filaSiguiente = rowsFinal.length
  const totalCols = 18

  for (const p of nuevos) {
    const valores = [
      p.codigo, p.nombre, p.descripcion, p.color, p.categoria, p.dimensiones,
      p.moq, p.cbm, p.fob, null, null, p.margenMay, p.precioMay,
      p.margenDet, p.precioDet, p.tieneFoto, p.archivoOrigen, p.notas,
    ]

    valores.forEach((val, ci) => {
      if (val == null) return
      const addr = cel(wsFinal, filaSiguiente, ci)
      const esNumero = typeof val === 'number'
      wsFinal[addr] = {
        t: esNumero ? 'n' : 's',
        v: val,
        ...(esNumero && [8, 10, 12, 14].includes(ci) ? { z: '#,##0.00' } : {}),
        ...(esNumero && (ci === 11 || ci === 13) ? { z: '0.00"%"' } : {}),
      }
    })
    filaSiguiente++
  }

  const totalFilas = filaSiguiente
  wsFinal['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalFilas - 1, c: totalCols - 1 } })

  XLSX.writeFile(wbFinal, FINAL, { bookSST: false, type: 'file', cellStyles: true })

  console.log(`\n✓ FINAL actualizado: ${FINAL}`)
  console.log(`  Productos nuevos agregados: ${nuevos.length}`)
  console.log(`  Total productos en catálogo ahora: ${filaSiguiente - 1}`)

  // Guardar el detalle de dimensiones estructuradas (main+mirror) para el
  // paso posterior de corrección de `dimensiones` jsonb en Supabase, porque
  // el parser genérico de importar-catalogo-final.js (parseDim) solo separa
  // 3 medidas y no sabe de las dos sub-piezas de este producto.
  const dimJsonPath = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'mirror-cabinets-dimensiones.json')
  fs.writeFileSync(dimJsonPath, JSON.stringify(
    nuevos.map(p => ({ codigo: p.codigo, dimensiones: p.dimensionesJson })), null, 2
  ))
  console.log(`  Dimensiones estructuradas guardadas para post-proceso: ${dimJsonPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
