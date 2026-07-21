/**
 * Extrae productos únicos de proforma_lineas y los inserta en la tabla productos.
 * También linkea historial_precios.producto_id y proforma_lineas.producto_id.
 *
 * Uso: node extract-productos.js [--dry-run]
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve('../../app/.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const dryRun = process.argv.includes('--dry-run')
if (dryRun) console.log('DRY RUN — no se insertará nada\n')

// ─── Códigos a ignorar (junk / datos de prueba) ───────────────────────────────
const IGNORAR = new Set(['USD -', 'TZ-343', 'SETS', ''])

// ─── Asignación de categoría por código y descripción ─────────────────────────
function inferirCategoria(codigo, desc, catMap) {
  const c = (codigo || '').toUpperCase().trim()
  const d = (desc || '').toUpperCase()

  // Laundry tubs — no tenemos categoría para esto aún
  if (/^L-\d/.test(c) || d.includes('TUB LAUNDRY')) return null

  // Seat covers standalone (precio FOB < $8 o códigos conocidos)
  if (['202', 'H237', 'LP-202D', 'LP-H237', 'A072', 'A073'].includes(c)) return catMap['Seat Covers']

  // Gypsum / drywall
  if (d.includes('GYPSUM') || d.includes('MOISTURE-RESIST') || /BOARDS?\s+\d+X/.test(d)) return catMap['Gypsum']

  // Kitchen sinks
  if (/^(7546|TT-1[0-9]{3}|TT-8)/.test(c) || d.includes('KITCHEN SINK')) return catMap['Kitchen Sinks']
  if (d.includes('DROP IN SINK') || d.includes('UNDERCOUNTER BASIN')) return catMap['Kitchen Sinks']

  // Wash basins & pedestals
  if (/^TP-/.test(c)) return catMap['Wash Basins']
  if (/^17[0-9][A-Z]?$/.test(c) || /^4085/.test(c)) return catMap['Wash Basins']
  if (d.includes('WASHBASIN') || d.includes('WASH BASIN') || d.includes('PEDESTAL') || d.includes('COUNTER TOP BASIN') || d.includes('WALL HUNG BASIN')) return catMap['Wash Basins']

  // Cabinets — series numéricas 7xxx, BX7, CH-T, T006, T007L, 3287, TG00, T209
  if (/^(7[0-9]{3}|BX7|CH-T|T006-|T007L-|3287|TG0|T209)/.test(c)) return catMap['Cabinets']
  if (d.includes('CABINET') || d.includes('CABINET/BASIN')) return catMap['Cabinets']

  // Shower doors
  if (/^(F-[23456]|F-6|GD-|CH-F)/.test(c)) return catMap['Shower Doors']
  if (d.includes('SHOWER DOOR') || (d.includes('SHOWER') && d.includes('GLASS'))) return catMap['Shower Doors']

  // Coolers — serie F40xxx, F90xxx, XC-, E268 (piezas de cooler de E&R)
  if (/^(F40|F90|XC-|E268)/.test(c) || d.includes('COOLER')) return catMap['Coolers']

  // PVC / MDF Doors
  if (/^(KM-|KMC-|KS-|MA-|BN-|KY|D-0[0-9])/.test(c)) return catMap['Puertas']
  if (d.includes('DOOR LEAF') || d.includes('PVC DOOR') || d.includes('MDF') || (d.includes('DOOR') && !d.includes('SHOWER'))) return catMap['Puertas']

  // Windows — W1-W99 series + JK + JNE
  if (/^(W\d{1,2}$|JK\d|JNE\d)/.test(c)) return catMap['Ventanas']
  if (d.includes('WINDOW') || d.includes('ALUMINIUM FRAME')) return catMap['Ventanas']

  // Toilets — TZ, HK, A5xx, M1xx, AS4, TSH, HJB- + descripción TOILET
  if (/^(TZ-|HK|AS4|A5[0-9]{2}|M1[0-9]{2}|TSH-|HJB-\d)/.test(c)) return catMap['Sanitarios']
  if (d.includes('TOILET') || d.includes('TWO PIECE') || d.includes('ONE PIECE')) return catMap['Sanitarios']

  return null
}

// Limpia descripciones: quita sufijos de componente H&L y espacios extra
function limpiarDesc(desc) {
  return (desc || '')
    .replace(/\s*\((TANK|BOWL|SEATCOVER|SEAT COVER|SOFTCLOSE)\)\s*/gi, ' ')
    .replace(/\b(TANK|BOWL)\b/g, '')        // quita TANK / BOWL solos al final
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Frecuencia de un array de strings → la más común
function masComun(arr) {
  const freq = {}
  for (const v of arr) freq[v] = (freq[v] || 0) + 1
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || null
}

async function extraerProductos() {
  // 1. Cargar categorías
  const { data: cats } = await supabase.from('categorias_producto').select('id, nombre')
  const catMap = {}
  for (const c of cats || []) catMap[c.nombre] = c.id
  console.log('Categorías cargadas:', Object.keys(catMap).join(', '))

  // 2. Cargar todas las líneas de proforma
  const { data: lineas } = await supabase
    .from('proforma_lineas')
    .select('id, codigo_pdf, descripcion_pdf, precio_costo_usd, precio_cliente_usd, proforma_id')

  console.log(`\nLíneas totales: ${lineas?.length || 0}`)

  // 3. Agrupar por código
  const grupos = new Map()
  for (const l of lineas || []) {
    const key = (l.codigo_pdf || '').trim()
    if (!key || IGNORAR.has(key) || key.length < 2) continue
    // Saltar códigos numéricos puros sin descripción útil (son probablemente errores)
    if (/^\d+$/.test(key) && !(l.descripcion_pdf || '').match(/[A-Z]{3}/i)) continue

    if (!grupos.has(key)) {
      grupos.set(key, {
        codigo: key,
        descs: [],
        precios_fob: [],
        ids_lineas: [],
      })
    }
    const g = grupos.get(key)
    const descLimpia = limpiarDesc(l.descripcion_pdf)
    if (descLimpia) g.descs.push(descLimpia)
    if (l.precio_costo_usd) g.precios_fob.push(l.precio_costo_usd)
    g.ids_lineas.push(l.id)
  }

  console.log(`Códigos únicos válidos: ${grupos.size}\n`)

  // 4. Insertar productos
  let insertados = 0, sinCategoria = 0, errores = 0
  const codigoAProductoId = new Map() // codigo → uuid en productos

  for (const [codigo, g] of grupos) {
    const descTop = masComun(g.descs) || codigo
    const categoriaId = inferirCategoria(codigo, descTop, catMap)
    const precioFob = g.precios_fob.length
      ? g.precios_fob[g.precios_fob.length - 1]  // precio más reciente
      : null

    const veces = g.ids_lineas.length
    const catNombre = Object.entries(catMap).find(([, id]) => id === categoriaId)?.[0] || 'SIN CATEGORÍA'

    if (dryRun) {
      console.log(`[${catNombre.padEnd(14)}] ${codigo.padEnd(14)} x${String(veces).padStart(3)} FOB:${String(precioFob||'-').padStart(7)} | ${descTop.substring(0, 55)}`)
      continue
    }

    // Verificar si ya existe
    const { data: existe } = await supabase
      .from('productos')
      .select('id')
      .eq('codigo_tangshan', codigo)
      .single()

    if (existe) {
      codigoAProductoId.set(codigo, existe.id)
      continue
    }

    const { data: prod, error } = await supabase
      .from('productos')
      .insert({
        codigo_tangshan: codigo,
        descripcion: descTop,
        categoria_id: categoriaId,
        precio_fob_usd: precioFob,
        estado: 'activo',
      })
      .select('id')
      .single()

    if (error) {
      console.error(`  ERROR ${codigo}: ${error.message}`)
      errores++
      continue
    }

    codigoAProductoId.set(codigo, prod.id)
    insertados++

    if (!categoriaId) sinCategoria++
    const icon = categoriaId ? '✓' : '?'
    console.log(`  ${icon} ${codigo.padEnd(14)} [${catNombre}] — ${descTop.substring(0, 50)}`)
  }

  if (dryRun) {
    console.log(`\nTotal que se insertaría: ${grupos.size} productos`)
    return
  }

  console.log(`\nProductos insertados: ${insertados} | Sin categoría: ${sinCategoria} | Errores: ${errores}`)

  // 5. Linkear historial_precios.producto_id
  console.log('\nLinkeando historial_precios...')
  const { data: historial } = await supabase
    .from('historial_precios')
    .select('id, codigo_pdf')

  let hLinkeados = 0
  for (const h of historial || []) {
    const productoId = codigoAProductoId.get((h.codigo_pdf || '').trim())
    if (!productoId) continue
    await supabase.from('historial_precios').update({ producto_id: productoId }).eq('id', h.id)
    hLinkeados++
  }
  console.log(`  historial_precios linkeados: ${hLinkeados}/${historial?.length || 0}`)

  // 6. Linkear proforma_lineas.producto_id
  console.log('Linkeando proforma_lineas...')
  let lLinkeados = 0
  for (const l of lineas || []) {
    const productoId = codigoAProductoId.get((l.codigo_pdf || '').trim())
    if (!productoId) continue
    await supabase.from('proforma_lineas').update({ producto_id: productoId }).eq('id', l.id)
    lLinkeados++
  }
  console.log(`  proforma_lineas linkeadas: ${lLinkeados}/${lineas?.length || 0}`)

  console.log('\n✓ Catálogo de productos generado exitosamente')
}

extraerProductos().catch(err => {
  console.error('ERROR FATAL:', err)
  process.exit(1)
})
