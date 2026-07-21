/**
 * Extrae imágenes de archivos Excel (.xlsx) y las renombra por código de producto.
 * Requiere que los .xls hayan sido guardados como .xlsx desde Excel primero.
 *
 * Uso: node extraer-imagenes-excel.js
 * Salida: Desktop/Europartners_Imagenes/{categoria}/{codigo}.{ext}
 */
import AdmZip from 'adm-zip'
import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import os from 'os'

const BASE   = 'C:/Users/Jeronimo/Desktop/Europrtners/Archivos para BD'
const SALIDA = path.join(os.homedir(), 'Desktop', 'Europartners_Imagenes')

// ── Parsear el XML de dibujos para obtener {índice_imagen → fila_anclaje} ──
// El archivo xl/drawings/drawing1.xml tiene elementos <xdr:oneCellAnchor> o
// <xdr:twoCellAnchor> con <xdr:from><xdr:row>N</xdr:row> y <xdr:pic><xdr:blipFill>
// que referencia la imagen por r:embed="rId{N}".
// xl/drawings/_rels/drawing1.xml.rels mapea rId → xl/media/image{N}.ext

function parsearDrawingXml(xmlStr) {
  // Extrae pares { rId, fila } de los anchors
  const anchors = []

  // Soporta oneCellAnchor y twoCellAnchor
  const anchorReg = /<xdr:(?:one|two)CellAnchor[\s\S]*?<\/xdr:(?:one|two)CellAnchor>/g
  const bloques = xmlStr.match(anchorReg) || []

  for (const bloque of bloques) {
    const filaM = bloque.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/)
    const ridM  = bloque.match(/r:embed="(rId\d+)"/)
    if (filaM && ridM) {
      anchors.push({ rId: ridM[1], fila: parseInt(filaM[1]) })
    }
  }
  return anchors
}

function parsearRels(relsStr) {
  // Mapea rId → nombre de archivo de imagen (ej. "image1.png")
  const map = {}
  const reg = /Id="(rId\d+)"[^>]*Target="\.\.\/media\/([^"]+)"/g
  let m
  while ((m = reg.exec(relsStr)) !== null) {
    map[m[1]] = m[2]   // rId1 → "image1.png"
  }
  return map
}

// ── Extraer imágenes de un archivo xlsx ──────────────────────
// codigos: array de { fila (0-based en la hoja), codigo }
// La fila del dibujo es 0-based en el XML (fila 0 = cabecera, fila 1 = primer dato, etc.)
function extraerImagenes(archivoXlsx, codigos, categoria) {
  const nombreArchivo = path.basename(archivoXlsx)

  if (!fs.existsSync(archivoXlsx)) {
    console.log(`  ⚠️  No encontrado: ${nombreArchivo}`)
    console.log(`     Guarda el archivo .xls como .xlsx desde Excel y vuelve a ejecutar.`)
    return { ok: 0, total: 0 }
  }

  let zip
  try {
    zip = new AdmZip(archivoXlsx)
  } catch (e) {
    console.log(`  ⚠️  No se pudo leer como ZIP: ${nombreArchivo} — asegúrate de guardarlo como .xlsx`)
    return { ok: 0, total: 0 }
  }

  const entries = zip.getEntries().map(e => e.entryName)

  // Buscar el drawing XML (puede ser drawing1.xml o en hojas distintas)
  const drawingEntry = entries.find(e => e.match(/xl\/drawings\/drawing\d+\.xml$/) && !e.includes('_rels'))
  const relsEntry    = entries.find(e => e.match(/xl\/drawings\/_rels\/drawing\d+\.xml\.rels$/))
  const mediaEntries = entries.filter(e => e.startsWith('xl/media/'))

  console.log(`\n  📂 ${nombreArchivo}`)
  console.log(`     Imágenes en xl/media: ${mediaEntries.length}`)
  console.log(`     Drawing XML: ${drawingEntry || 'no encontrado'}`)
  console.log(`     Rels: ${relsEntry || 'no encontrado'}`)

  if (!drawingEntry || !relsEntry || mediaEntries.length === 0) {
    console.log(`     ⚠️  Sin imágenes mapeables en este archivo.`)
    return { ok: 0, total: mediaEntries.length }
  }

  const drawingXml = zip.readAsText(drawingEntry)
  const relsXml    = zip.readAsText(relsEntry)

  const anchors = parsearDrawingXml(drawingXml)  // [{rId, fila}]
  const rIdMap  = parsearRels(relsXml)            // {rId → "image1.png"}

  // Combinar: para cada anchor, obtener { fila, archivoMedia }
  const mapaFilaImagen = {}
  for (const { rId, fila } of anchors) {
    if (rIdMap[rId]) mapaFilaImagen[fila] = rIdMap[rId]
  }

  console.log(`     Anchors encontrados: ${anchors.length}`)
  console.log(`     Mapa fila→imagen:`, mapaFilaImagen)

  const carpeta = path.join(SALIDA, categoria)
  fs.mkdirSync(carpeta, { recursive: true })

  let ok = 0
  for (const { fila, codigo } of codigos) {
    const archivoImg = mapaFilaImagen[fila]
    if (!archivoImg) {
      console.log(`     ⚠️  Sin imagen para fila ${fila} (${codigo})`)
      continue
    }

    const ext       = path.extname(archivoImg)  // .png, .jpg, etc.
    const imgData   = zip.readFile(`xl/media/${archivoImg}`)
    const destino   = path.join(carpeta, `${codigo}${ext}`)
    fs.writeFileSync(destino, imgData)
    console.log(`     ✓ fila ${fila} → ${codigo}${ext}`)
    ok++
  }

  return { ok, total: codigos.length }
}

// ── Limpiar texto para usarlo como nombre de archivo ─────────
function limpiarCodigo(v) {
  return String(v || '')
    .replace(/[\r\n]+/g, ' ')   // saltos de línea → espacio
    .replace(/[\\/:*?"<>|]/g, '') // caracteres inválidos en Windows
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Obtener mapeo fila→codigo de cada archivo ────────────────

function mapaArtBasin() {
  const wb   = XLSX.read(fs.readFileSync(path.join(BASE, 'ART BASIN INFORMATION (China).xlsx')), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['远威'], { header: 1, defval: null })
  const codigos = []
  for (let i = 2; i < rows.length; i++) {
    const codigo = limpiarCodigo(rows[i]?.[0])
    if (codigo) codigos.push({ fila: i, codigo })
  }
  return codigos
}

function mapaBigBasin(archivo) {
  const wb   = XLSX.read(fs.readFileSync(archivo), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { header: 1, defval: null })
  const codigos = []
  for (let i = 2; i < rows.length; i++) {
    const codigo = limpiarCodigo(rows[i]?.[0])
    if (codigo) codigos.push({ fila: i, codigo })
  }
  return codigos
}

function mapaMirror(archivo) {
  const wb   = XLSX.read(fs.readFileSync(archivo), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { header: 1, defval: null })
  const codigos = []
  for (let i = 2; i < rows.length; i++) {
    const ref = limpiarCodigo(rows[i]?.[1])
    if (ref) codigos.push({ fila: i, codigo: ref })
  }
  return codigos
}

// ── MAIN ─────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(SALIDA, { recursive: true })
  console.log(`Destino: ${SALIDA}\n`)

  const archivos = [
    {
      nombre:    'ART BASIN INFORMATION (China).xlsx',
      categoria: 'Art Basins',
      getCodigos: () => mapaArtBasin(),
    },
    {
      // Requiere guardarlo como .xlsx desde Excel
      nombre:    'BIG BASIN PRICE LIST.xlsx',
      categoria: 'Big Basins',
      getCodigos: (f) => mapaBigBasin(f),
    },
    {
      // Requiere guardarlo como .xlsx desde Excel
      nombre:    'NEW PRICE LIST FOR MIRROR AND ROCK PLATE (JERO).xlsx',
      categoria: 'Mirrors y Rock Plates',
      getCodigos: (f) => mapaMirror(f),
    },
  ]

  let totalOk = 0, totalProductos = 0

  for (const cfg of archivos) {
    const ruta = path.join(BASE, cfg.nombre)
    if (!fs.existsSync(ruta)) {
      console.log(`\n  ⏭️  ${cfg.nombre} — no encontrado como .xlsx`)
      console.log(`     Abre el archivo original en Excel → Guardar como → .xlsx`)
      continue
    }
    const codigos = cfg.getCodigos(ruta)
    const { ok, total } = extraerImagenes(ruta, codigos, cfg.categoria)
    totalOk       += ok
    totalProductos += total
  }

  console.log(`\n──────────────────────────────────────────`)
  console.log(`✓ Imágenes guardadas: ${totalOk} / ${totalProductos}`)
  console.log(`  Carpeta: ${SALIDA}`)
  console.log(`\nNota: Las imágenes sin extraer son de archivos .xls`)
  console.log(`      Ábrelos en Excel → Guardar como .xlsx → ejecuta de nuevo.`)
}

main().catch(e => { console.error(e); process.exit(1) })
