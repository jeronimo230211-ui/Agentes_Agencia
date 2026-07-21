/**
 * Importa el catálogo FINAL completo (183 productos) a Supabase v2:
 *   1. Lee la hoja "📦 Catálogo Consolidado" del Excel FINAL (genérico por índice de columna)
 *   2. Lee la hoja "Cruce Catalogo vs Historial" para el indicador de historial
 *   3. Crea categorías faltantes
 *   4. Upsert de productos (idempotente por código, actualiza los ya existentes)
 *   5. Sube imágenes a Supabase Storage y actualiza imagen_url
 *
 * Reemplaza a importar-catalogo.js (obsoleto, ver comentario en ese archivo).
 *
 * Uso:
 *   node importar-catalogo-final.js --dry-run   (solo imprime, no escribe nada)
 *   node importar-catalogo-final.js --write     (aplica los cambios)
 */
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve('../../app/.env.local') })

const WRITE = process.argv.includes('--write')

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const FINAL  = 'C:/Users/Jeronimo/OneDrive/Europartners_BD/BD_Catalogo_EUP/Europartners_Analisis_Catalogo_2026-07-05_FINAL (1) (1).xlsx'
const CRUCE  = 'C:/Users/Jeronimo/OneDrive/Europartners_BD/BD_Catalogo_EUP/Europartners_BD_Proformas_y_Precios.xlsx'
const IMG_DIR = 'C:/Users/Jeronimo/OneDrive/Europartners_BD/Europartners_Imagenes'
const BUCKET  = 'productos'
const HOY     = new Date().toISOString().split('T')[0]
const AHORA   = new Date().toISOString()

// Carpetas de imágenes que no coinciden 1:1 con el nombre de categoría actual
// (categorías renombradas en julio que se quedaron en la carpeta vieja/compartida)
const CATEGORIA_A_CARPETA = {
  'Countertop bathroom vanities': 'Art Basins',
  'Sintered Stone Sinks': 'Mirrors y Rock Plates',
  'Mirrors': 'Mirrors y Rock Plates',
}
function carpetaDe(categoria) {
  return CATEGORIA_A_CARPETA[categoria] || categoria
}

// ── Helpers (reusados de importar-catalogo.js) ───────────────
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
function esSi(v) {
  const s = String(v || '').trim().toLowerCase()
  return s === 'sí' || s === 'si'
}
function fechaOk(v) {
  if (!v) return null
  const s = String(v).trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

// ── 1. Leer catálogo FINAL (18 columnas, índice fijo) ────────
const COL = {
  codigo: 0, nombre: 1, descripcion: 2, colorVariante: 3, categoria: 4,
  dimensiones: 5, moq: 6, cbmUnitario: 7, precioFobUsd: 8, precioExwRmbBigBasin: 9,
  precioFobFullContainer: 10, margenMayoristaPct: 11, precioMayorista: 12,
  margenDetallistaPct: 13, precioDetallista: 14, tieneFoto: 15, archivoOrigen: 16, notas: 17,
}

function leerCatalogo() {
  const wb = XLSX.read(fs.readFileSync(FINAL), { type: 'buffer' })
  const ws = wb.Sheets['📦 Catálogo Consolidado']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  // Códigos duplicados a propósito en el Excel (ej. 173A/173B: "Art Basin" vs
  // "Bathroom Sink Thansang", mismo código, pendiente de resolver con Marta/
  // proveedor — ver Notas). productos.codigo es único en Supabase, así que a
  // partir de la 2da aparición se le agrega un sufijo para no perder ninguna
  // de las dos filas por un upsert silencioso.
  const vistos = new Map()

  const productos = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const codigoOriginal = codigoLimpio(r?.[COL.codigo])
    if (!codigoOriginal) continue

    const nVeces = (vistos.get(codigoOriginal) || 0) + 1
    vistos.set(codigoOriginal, nVeces)
    const codigo = nVeces === 1 ? codigoOriginal : `${codigoOriginal}-DUP${nVeces}`
    const notaDuplicado = nVeces > 1
      ? `⚠️ Código original "${codigoOriginal}" duplicado en el Excel FINAL (fila ${i + 1}) — renombrado a "${codigo}" para poder coexistir en Supabase. Revisar con Marta/proveedor si es el mismo producto.`
      : null

    const categoria = limpiar(r[COL.categoria])
    productos.push({
      codigo,
      codigoOriginal,
      nombre: limpiar(r[COL.nombre]) || codigo,
      descripcion: limpiar(r[COL.descripcion]) || null,
      color_variante: r[COL.colorVariante] != null ? limpiar(r[COL.colorVariante]) || null : null,
      categoria,
      carpeta_imagen: carpetaDe(categoria),
      dimensiones: parseDim(r[COL.dimensiones]),
      moq: r[COL.moq] != null ? Math.round(num(r[COL.moq])) : null,
      cbm_unitario: num(r[COL.cbmUnitario]),
      precio_fob_usd: num(r[COL.precioFobUsd]),
      precio_exw_rmb_bigbasin: num(r[COL.precioExwRmbBigBasin]),
      precio_fob_full_container: num(r[COL.precioFobFullContainer]),
      margen_mayorista_pct: num(r[COL.margenMayoristaPct]),
      precio_mayorista: num(r[COL.precioMayorista]),
      margen_detallista_pct: num(r[COL.margenDetallistaPct]),
      precio_detallista: num(r[COL.precioDetallista]),
      tiene_foto: esSi(r[COL.tieneFoto]),
      archivo_origen: r[COL.archivoOrigen] != null ? limpiar(r[COL.archivoOrigen]) || null : null,
      notas: [notaDuplicado, r[COL.notas] != null ? limpiar(r[COL.notas]) || null : null].filter(Boolean).join(' | ') || null,
    })
  }
  return productos
}

// ── 2. Leer Cruce Catalogo vs Historial (20 columnas, índice fijo) ──
const COL_CRUCE = {
  codigo: 0, vendidoAntes: 6, categoriaVieja: 7, vecesVendido: 8, clientesCompradores: 9,
  fechaPrimeraVenta: 10, fechaUltimaVenta: 11, precioCostoHistoricoMin: 12,
  precioClienteHistoricoMin: 13, precioClienteHistoricoMax: 14, precioClienteHistoricoPromedio: 15,
  precioClienteHistoricoUltimo: 16, margenHistoricoPctUltimo: 17,
  variacionPctMayoristaVsHistorico: 18, variacionPctDetallistaVsHistorico: 19,
}

function leerCruce() {
  const wb = XLSX.read(fs.readFileSync(CRUCE), { type: 'buffer' })
  const ws = wb.Sheets['Cruce Catalogo vs Historial']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  // Map<codigoOriginal, array> — algunos códigos aparecen 2 veces en el Excel
  // (mismo duplicado a propósito que en leerCatalogo), se emparejan en orden.
  const mapa = new Map()
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const codigo = codigoLimpio(r?.[COL_CRUCE.codigo])
    if (!codigo) continue
    if (!mapa.has(codigo)) mapa.set(codigo, [])
    mapa.get(codigo).push({
      tiene_historial: esSi(r[COL_CRUCE.vendidoAntes]),
      categoria_vieja: r[COL_CRUCE.categoriaVieja] != null ? limpiar(r[COL_CRUCE.categoriaVieja]) || null : null,
      veces_vendido: r[COL_CRUCE.vecesVendido] != null ? Math.round(num(r[COL_CRUCE.vecesVendido])) : null,
      clientes_compradores: r[COL_CRUCE.clientesCompradores] != null ? limpiar(r[COL_CRUCE.clientesCompradores]) || null : null,
      fecha_primera_venta: fechaOk(r[COL_CRUCE.fechaPrimeraVenta]),
      fecha_ultima_venta: fechaOk(r[COL_CRUCE.fechaUltimaVenta]),
      precio_costo_historico_min: num(r[COL_CRUCE.precioCostoHistoricoMin]),
      precio_cliente_historico_min: num(r[COL_CRUCE.precioClienteHistoricoMin]),
      precio_cliente_historico_max: num(r[COL_CRUCE.precioClienteHistoricoMax]),
      precio_cliente_historico_promedio: num(r[COL_CRUCE.precioClienteHistoricoPromedio]),
      precio_cliente_historico_ultimo: num(r[COL_CRUCE.precioClienteHistoricoUltimo]),
      margen_historico_pct_ultimo: num(r[COL_CRUCE.margenHistoricoPctUltimo]),
      variacion_pct_mayorista_vs_historico: num(r[COL_CRUCE.variacionPctMayoristaVsHistorico]),
      variacion_pct_detallista_vs_historico: num(r[COL_CRUCE.variacionPctDetallistaVsHistorico]),
    })
  }
  return mapa
}

// ── 3. Asegurar categorías en Supabase ────────────────────────
async function asegurarCategorias(nombres) {
  const { data: existentes } = await sb.from('categorias_producto').select('id, nombre')
  const mapa = {}
  for (const c of existentes) mapa[c.nombre] = c.id

  const nuevas = nombres.filter(n => !mapa[n])
  if (nuevas.length) {
    if (!WRITE) {
      console.log(`  + Categorías a crear: ${nuevas.join(', ')}`)
      nuevas.forEach((n, i) => { mapa[n] = `(pendiente-${i})` })
      return mapa
    }
    const { data, error } = await sb.from('categorias_producto')
      .insert(nuevas.map((n, i) => ({ nombre: n, orden: 20 + i })))
      .select('id, nombre')
    if (error) throw error
    for (const c of data) mapa[c.nombre] = c.id
    console.log(`  + Categorías creadas: ${nuevas.join(', ')}`)
  } else {
    console.log(`  ✓ Todas las categorías ya existen`)
  }
  return mapa
}

// ── 4. Upsert de productos (merge catálogo + cruce) ───────────
async function upsertProductos(productos, cruceMap, catMap) {
  let ok = 0, err = 0, conHistorial = 0
  for (const p of productos) {
    const cat_id = catMap[p.categoria]
    if (!cat_id) { console.warn(`  ⚠️  Sin categoría resuelta: ${p.categoria} (${p.codigo})`); err++; continue }

    // Emparejar por código original y en orden (shift), no por p.codigo ya
    // sufijado — así cada aparición del duplicado se lleva su propia fila de cruce.
    const cruce = cruceMap.get(p.codigoOriginal)?.shift()
    if (cruce?.tiene_historial) conHistorial++

    const registro = {
      codigo: p.codigo,
      nombre: p.nombre,
      descripcion: p.descripcion,
      categoria_id: cat_id,
      dimensiones: p.dimensiones,
      color_variante: p.color_variante,
      moq: p.moq,
      cbm_unitario: p.cbm_unitario,
      precio_fob_usd: p.precio_fob_usd,
      precio_fob_fecha: HOY,
      precio_exw_rmb_bigbasin: p.precio_exw_rmb_bigbasin,
      precio_fob_full_container: p.precio_fob_full_container,
      margen_mayorista_pct: p.margen_mayorista_pct,
      precio_mayorista: p.precio_mayorista,
      margen_detallista_pct: p.margen_detallista_pct,
      precio_detallista: p.precio_detallista,
      tiene_foto: p.tiene_foto,
      archivo_origen: p.archivo_origen,
      notas: p.notas,
      estado: 'activo',
      // indicador de historial
      tiene_historial: cruce?.tiene_historial || false,
      categoria_vieja: cruce?.categoria_vieja ?? null,
      veces_vendido: cruce?.veces_vendido ?? null,
      clientes_compradores: cruce?.clientes_compradores ?? null,
      fecha_primera_venta: cruce?.fecha_primera_venta ?? null,
      fecha_ultima_venta: cruce?.fecha_ultima_venta ?? null,
      precio_costo_historico_min: cruce?.precio_costo_historico_min ?? null,
      precio_cliente_historico_min: cruce?.precio_cliente_historico_min ?? null,
      precio_cliente_historico_max: cruce?.precio_cliente_historico_max ?? null,
      precio_cliente_historico_promedio: cruce?.precio_cliente_historico_promedio ?? null,
      precio_cliente_historico_ultimo: cruce?.precio_cliente_historico_ultimo ?? null,
      margen_historico_pct_ultimo: cruce?.margen_historico_pct_ultimo ?? null,
      variacion_pct_mayorista_vs_historico: cruce?.variacion_pct_mayorista_vs_historico ?? null,
      variacion_pct_detallista_vs_historico: cruce?.variacion_pct_detallista_vs_historico ?? null,
      historial_actualizado_at: AHORA,
    }

    if (!WRITE) { ok++; continue }

    const { error } = await sb.from('productos').upsert(registro, { onConflict: 'codigo' })
    if (error) { console.error(`  ✗ ${p.codigo}: ${error.message}`); err++ }
    else { ok++ }
  }
  return { ok, err, conHistorial }
}

// ── 5. Subir imágenes y actualizar imagen_url ─────────────────
async function subirImagenes(productos) {
  if (WRITE) {
    const { data: buckets } = await sb.storage.listBuckets()
    const existe = buckets?.some(b => b.name === BUCKET)
    if (!existe) {
      const { error } = await sb.storage.createBucket(BUCKET, { public: true })
      if (error && !error.message.includes('already')) throw error
      console.log(`  + Bucket '${BUCKET}' creado`)
    }
  }

  let ok = 0, sinImg = 0
  for (const p of productos) {
    const carpeta = path.join(IMG_DIR, p.carpeta_imagen)
    // El archivo local siempre está nombrado con el código ORIGINAL (sin el
    // sufijo -DUP2 que se le agregó al codigo de Supabase para desambiguar).
    let archivoImg = null
    for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
      const candidato = path.join(carpeta, `${p.codigoOriginal}${ext}`)
      if (fs.existsSync(candidato)) { archivoImg = candidato; break }
    }

    if (!archivoImg) { sinImg++; continue }

    if (!WRITE) { ok++; continue }

    const ext = path.extname(archivoImg)
    const storagePath = `${p.carpeta_imagen}/${p.codigo}${ext}`
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
    const buffer = fs.readFileSync(archivoImg)

    const { error: upErr } = await sb.storage.from(BUCKET)
      .upload(storagePath, buffer, { contentType: mime, upsert: true })

    if (upErr) { console.error(`  ✗ Upload ${p.codigo}: ${upErr.message}`); continue }

    const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(storagePath)
    const { error: updErr } = await sb.from('productos').update({ imagen_url: publicUrl }).eq('codigo', p.codigo)
    if (updErr) console.error(`  ✗ URL update ${p.codigo}: ${updErr.message}`)
    else ok++
  }

  return { ok, sinImg }
}

// ── MAIN ─────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════')
  console.log(`  EUROPARTNERS — Importación catálogo FINAL (${WRITE ? 'WRITE' : 'DRY-RUN'})`)
  console.log('═══════════════════════════════════════════\n')

  const productos = leerCatalogo()
  const cruceMap = leerCruce()
  console.log(`Productos en catálogo FINAL: ${productos.length}`)
  console.log(`Códigos con dato de cruce histórico: ${cruceMap.size}\n`)

  if (!WRITE) {
    console.log('── Preview primeras 5 filas (catálogo + cruce mergeado) ──')
    productos.slice(0, 5).forEach(p => {
      const c = cruceMap.get(p.codigoOriginal)?.[0]  // peek, no consumir (el merge real hace shift())
      console.log(`  ${p.codigo} | ${p.nombre} | cat="${p.categoria}" carpeta="${p.carpeta_imagen}" | FOB=${p.precio_fob_usd} May=${p.precio_mayorista} Det=${p.precio_detallista} | historial=${c?.tiene_historial ?? false} (${c?.veces_vendido ?? 0}x)`)
    })
    console.log('')
  }

  console.log('── Categorías ──────────────────────────────')
  const categorias = [...new Set(productos.map(p => p.categoria))]
  const catMap = await asegurarCategorias(categorias)

  console.log('\n── Productos ───────────────────────────────')
  const { ok: pOk, err: pErr, conHistorial } = await upsertProductos(productos, cruceMap, catMap)
  console.log(`  ${WRITE ? 'Insertados/actualizados' : 'A insertar/actualizar'}: ${pOk} | Errores: ${pErr} | Con historial: ${conHistorial}`)

  console.log('\n── Imágenes → Supabase Storage ─────────────')
  const { ok: iOk, sinImg } = await subirImagenes(productos)
  console.log(`  ${WRITE ? 'Subidas' : 'Encontradas localmente (a subir)'}: ${iOk} | Sin imagen: ${sinImg}`)

  console.log('\n═══════════════════════════════════════════')
  console.log(`  ${WRITE ? '✓ Importación completa' : 'Dry-run completo — corre con --write para aplicar'}`)
  console.log(`    Productos: ${pOk}/${productos.length}`)
  console.log(`    Imágenes:  ${iOk}/${productos.length - sinImg + iOk}`)
  console.log('═══════════════════════════════════════════')
}

main().catch(e => { console.error('\nERROR FATAL:', e.message); process.exit(1) })
