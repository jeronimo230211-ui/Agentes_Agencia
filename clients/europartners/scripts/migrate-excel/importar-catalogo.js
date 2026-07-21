/**
 * DEPRECADO (2026-07-20) — reemplazado por importar-catalogo-final.js.
 * Este script tiene parsers hechos a mano por archivo Excel viejo (Art Basin/
 * Big Basin/Mirror), apunta a una ruta de Desktop que ya no existe
 * ("C:/Users/Jeronimo/Desktop/Europrtners/Archivos para BD") y nunca sube
 * precio_may/precio_det. Solo cubre 56 de los 183 productos del catálogo
 * FINAL actual. No correr — se deja como referencia histórica.
 *
 * Importa el catálogo de productos a Supabase v2:
 *   1. Crea categorías faltantes
 *   2. Inserta/actualiza 56 productos
 *   3. Sube imágenes a Supabase Storage y actualiza imagen_url
 *
 * Uso: node importar-catalogo.js
 */
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import os from 'os'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve('../../app/.env.local') })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const BASE    = 'C:/Users/Jeronimo/Desktop/Europrtners/Archivos para BD'
const IMG_DIR = path.join(os.homedir(), 'Desktop', 'Europartners_Imagenes')
const BUCKET  = 'productos'
const HOY     = new Date().toISOString().split('T')[0]

// ── Helpers ───────────────────────────────────────────────────
function limpiar(v) {
  return String(v || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
}
function num(v) {
  if (v == null) return null
  if (typeof v === 'number') return +v.toFixed(4)
  const m = String(v).match(/[\d.]+/)
  return m ? parseFloat(m[0]) : null
}
function parseDim(texto) {
  if (!texto) return null
  const partes = String(texto).split(/[*xX×]/).map(p => parseFloat(p.trim())).filter(n => !isNaN(n))
  if (partes.length >= 3) return { largo_mm: partes[0], ancho_mm: partes[1], alto_mm: partes[2] }
  if (partes.length === 2) return { largo_mm: partes[0], ancho_mm: partes[1] }
  return null
}
function codigoLimpio(v) {
  return String(v || '').replace(/[\r\n]+/g, ' ').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
}

// ── 1. Parsear productos de los Excel ────────────────────────
function parsearArtBasin() {
  const wb   = XLSX.read(fs.readFileSync(path.join(BASE, 'ART BASIN INFORMATION (China).xlsx')), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['远威'], { header: 1, defval: null })
  const out  = []
  for (let i = 2; i < rows.length; i++) {
    const r      = rows[i] || []
    const codigo = codigoLimpio(r[0])
    if (!codigo) continue
    out.push({
      codigo,
      nombre:          `Art Basin ${codigo}`,
      descripcion:     `Art Basin ${codigo}`,
      categoria:       'Art Basins',
      dimensiones:     parseDim(r[3]),
      cbm_unitario:    null,
      precio_fob_usd:  num(r[5]),
      precio_may:      num(r[7]),
      precio_det:      num(r[9]),
      notas:           null,
      img_carpeta:     'Art Basins',
    })
  }
  return out
}

function parsearBigBasin() {
  const archivo = path.join(BASE, 'BIG BASIN PRICE LIST.xlsx')
  const wb   = XLSX.read(fs.readFileSync(archivo), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { header: 1, defval: null })
  const out  = []
  for (let i = 2; i < rows.length; i++) {
    const r      = rows[i] || []
    const codigo = codigoLimpio(r[0])
    if (!codigo) continue
    out.push({
      codigo,
      nombre:         limpiar(r[3]) || `Big Basin ${codigo}`,
      descripcion:    limpiar(r[3]),
      categoria:      'Big Basins',
      dimensiones:    parseDim(r[2]),
      cbm_unitario:   num(r[5]),
      precio_fob_usd: num(r[4]),       // EXW RMB — precio China de referencia
      precio_may:     num(r[9]),
      precio_det:     num(r[11]),
      notas:          'Precio China en RMB (EXW)',
      img_carpeta:    'Big Basins',
    })
  }
  return out
}

function parsearMirrorRock() {
  const archivo = path.join(BASE, 'NEW PRICE LIST FOR MIRROR AND ROCK PLATE (JERO).xlsx')
  const wb   = XLSX.read(fs.readFileSync(archivo), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { header: 1, defval: null })
  const out  = []
  for (let i = 2; i < rows.length; i++) {
    const r    = rows[i] || []
    const ref  = codigoLimpio(r[1])
    const name = limpiar(r[2])
    if (!ref && !name) continue

    const idx  = parseInt(ref.slice(-2))
    const cat  = ref.startsWith('WD1120') && idx <= 4 ? 'Rock Plate Sinks' : 'Mirrors'

    out.push({
      codigo:         ref || name,
      nombre:         name,
      descripcion:    limpiar(r[5]),
      categoria:      cat,
      dimensiones:    parseDim(r[6]),
      cbm_unitario:   num(r[17]),
      precio_fob_usd: num(r[9]),       // FOB Mix China
      precio_may:     num(r[12]),      // FOB Mix Europartners
      precio_det:     null,
      notas:          'Precios FOB Mix container',
      img_carpeta:    'Mirrors y Rock Plates',
    })
  }
  return out
}

// ── 2. Asegurar categorías en Supabase ────────────────────────
async function asegurarCategorias(nombres) {
  const { data: existentes } = await sb.from('categorias_producto').select('id, nombre')
  const mapa = {}
  for (const c of existentes) mapa[c.nombre] = c.id

  const nuevas = nombres.filter(n => !mapa[n])
  if (nuevas.length) {
    const { data, error } = await sb.from('categorias_producto')
      .insert(nuevas.map((n, i) => ({ nombre: n, orden: 20 + i })))
      .select('id, nombre')
    if (error) throw error
    for (const c of data) mapa[c.nombre] = c.id
    console.log(`  + Categorías creadas: ${nuevas.join(', ')}`)
  } else {
    console.log(`  ✓ Categorías ya existentes`)
  }
  return mapa
}

// ── 3. Insertar/actualizar productos ─────────────────────────
async function insertarProductos(productos, catMap) {
  let ok = 0, err = 0
  for (const p of productos) {
    const cat_id = catMap[p.categoria]
    if (!cat_id) { console.warn(`  ⚠️  Sin categoría: ${p.categoria}`); err++; continue }

    const registro = {
      codigo:          p.codigo,
      nombre:          p.nombre,
      descripcion:     p.descripcion || null,
      categoria_id:    cat_id,
      dimensiones:     p.dimensiones,
      precio_fob_usd:  p.precio_fob_usd,
      precio_fob_fecha: HOY,
      notas:           p.notas,
      estado:          'activo',
    }

    const { error } = await sb.from('productos')
      .upsert(registro, { onConflict: 'codigo' })

    if (error) { console.error(`  ✗ ${p.codigo}: ${error.message}`); err++ }
    else { ok++ }
  }
  return { ok, err }
}

// ── 4. Subir imágenes y actualizar imagen_url ─────────────────
async function subirImagenes(productos) {
  // Crear bucket si no existe
  const { data: buckets } = await sb.storage.listBuckets()
  const existe = buckets?.some(b => b.name === BUCKET)
  if (!existe) {
    const { error } = await sb.storage.createBucket(BUCKET, { public: true })
    if (error && !error.message.includes('already')) throw error
    console.log(`  + Bucket '${BUCKET}' creado`)
  }

  let ok = 0, sinImg = 0
  for (const p of productos) {
    const carpeta = path.join(IMG_DIR, p.img_carpeta)
    // Buscar imagen con cualquier extensión
    let archivoImg = null
    for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
      const candidato = path.join(carpeta, `${p.codigo}${ext}`)
      if (fs.existsSync(candidato)) { archivoImg = candidato; break }
    }

    if (!archivoImg) {
      console.log(`  ⚠️  Sin imagen: ${p.codigo}`)
      sinImg++
      continue
    }

    const ext        = path.extname(archivoImg)
    const storagePath = `${p.img_carpeta}/${p.codigo}${ext}`
    const mime        = ext === '.png' ? 'image/png' : 'image/jpeg'
    const buffer      = fs.readFileSync(archivoImg)

    const { error: upErr } = await sb.storage.from(BUCKET)
      .upload(storagePath, buffer, { contentType: mime, upsert: true })

    if (upErr) {
      console.error(`  ✗ Upload ${p.codigo}: ${upErr.message}`)
      continue
    }

    const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(storagePath)

    const { error: upd } = await sb.from('productos')
      .update({ imagen_url: publicUrl })
      .eq('codigo', p.codigo)

    if (upd) { console.error(`  ✗ URL update ${p.codigo}: ${upd.message}`) }
    else { console.log(`  ✓ ${p.codigo}${ext}`); ok++ }
  }

  return { ok, sinImg }
}

// ── MAIN ─────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  EUROPARTNERS — Importación catálogo v2')
  console.log('═══════════════════════════════════════════\n')

  // Parsear
  const artBasins = parsearArtBasin()
  const bigBasins = parsearBigBasin()
  const mirrors   = parsearMirrorRock()
  const todos     = [...artBasins, ...bigBasins, ...mirrors]

  console.log(`Productos a importar: ${todos.length}`)
  console.log(`  Art Basins:     ${artBasins.length}`)
  console.log(`  Big Basins:     ${bigBasins.length}`)
  console.log(`  Mirrors+Rock:   ${mirrors.length}\n`)

  // Categorías
  console.log('── Categorías ──────────────────────────────')
  const cats = [...new Set(todos.map(p => p.categoria))]
  const catMap = await asegurarCategorias(cats)

  // Productos
  console.log('\n── Productos ───────────────────────────────')
  const { ok: pOk, err: pErr } = await insertarProductos(todos, catMap)
  console.log(`  Insertados/actualizados: ${pOk} | Errores: ${pErr}`)

  // Imágenes
  console.log('\n── Imágenes → Supabase Storage ─────────────')
  const { ok: iOk, sinImg } = await subirImagenes(todos)
  console.log(`  Subidas: ${iOk} | Sin imagen: ${sinImg}`)

  console.log('\n═══════════════════════════════════════════')
  console.log(`  ✓ Importación completa`)
  console.log(`    Productos: ${pOk}/${todos.length}`)
  console.log(`    Imágenes:  ${iOk}/${todos.length - sinImg + iOk}`)
  console.log('═══════════════════════════════════════════')
}

main().catch(e => { console.error('\nERROR FATAL:', e.message); process.exit(1) })
