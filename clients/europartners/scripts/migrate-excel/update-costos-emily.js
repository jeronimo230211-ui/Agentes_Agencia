/**
 * Actualiza costos de Emily (precio_costo_usd) en proforma_lineas y historial_precios
 * a partir de los archivos PI de la carpeta "PROFORMAS PARA BASE DE DATOS".
 *
 * Uso:
 *   node update-costos-emily.js              → actualiza en DB
 *   node update-costos-emily.js --dry-run    → simula sin modificar nada
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../app/.env.local') })

const DRY_RUN = process.argv.includes('--dry-run')
if (DRY_RUN) console.log('🔍 DRY RUN — no se modificará nada en la base de datos\n')

const CARPETA_PI = 'C:/Users/Jeronimo/OneDrive/EUROPARTNERS/CHINA/THANSHAN/JAMAICA/PROFORMAS PARA BASE DE DATOS'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// ────────────────────────────────────────────────────────────────────────────────
// PARSERS MEJORADOS
// ────────────────────────────────────────────────────────────────────────────────

function parseNum(v) {
  if (v === null || v === undefined || v === '') return null
  const n = parseFloat(String(v).replace(/,/g, ''))
  return isNaN(n) ? null : n
}

function rowText(row) {
  return (row || []).map(c => String(c || '')).join(' ').trim()
}

function extraerNumero(texto) {
  const m = String(texto || '').match(/3-(\d{3,4})/)
  return m ? `3-${m[1]}` : null
}

/**
 * Detecta la fecha en las primeras 8 filas del Excel.
 */
function detectarFecha(rows) {
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    for (const cell of (rows[i] || [])) {
      if (!cell) continue
      if (typeof cell === 'number') {
        try {
          const d = XLSX.SSF.parse_date_code(cell)
          if (d && d.y > 2015 && d.y < 2040) {
            return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
          }
        } catch {}
      }
      const s = String(cell).trim()
      const d = new Date(s)
      if (!isNaN(d.getTime()) && d.getFullYear() > 2015 && d.getFullYear() < 2040) {
        return d.toISOString().split('T')[0]
      }
    }
  }
  return null
}

/**
 * Parser para formato "Tangshan Hoja1":
 *   - Header row: col[0]="QUANTITY", col[2]="CODE", col[3]="DESCRIPTION"
 *   - Sub-header row: detecta en qué columna está "UNIT PRICE"
 *   - Data rows: col[0]=qty, col[1]="SETS", col[2]=codigo, col[3]=desc, col[X]=fob_unit
 *
 * Este formato aparece en: 3-0162 (col[8]=price), 3-0158/3-0189/3-0201 (col[7]=price)
 */
function parsearHoja1(rows, nombreArchivo) {
  // Número: buscar en contenido primero, luego en nombre de archivo
  let numero = null
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    numero = extraerNumero(rowText(rows[i]))
    if (numero) break
  }
  if (!numero) numero = extraerNumero(nombreArchivo)

  const fecha = detectarFecha(rows)

  // Detectar fila header (tiene "QUANTITY" en col[0])
  let headerRow = -1
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i]?.[0] || '').toUpperCase().trim() === 'QUANTITY') {
      headerRow = i
      break
    }
  }
  if (headerRow < 0) return null

  // Detectar columna de precio buscando "UNIT PRICE" en las próximas 3 filas
  let colPrecio = 8  // default histórico
  let colTotal = 10
  for (let i = headerRow + 1; i < Math.min(headerRow + 4, rows.length); i++) {
    const row = rows[i] || []
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').toUpperCase().trim()
      if (cell.includes('UNIT PRICE') || cell === 'FOB PRICE USD') {
        colPrecio = j
        // Total suele estar 2 columnas después
        colTotal = j + 2
        break
      }
    }
    if (colPrecio !== 8) break
  }

  const lineas = []
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] || []

    // Parar en la fila de totales (más específico para no romper en sub-headers)
    const textoFila = rowText(row).toUpperCase()
    if (textoFila.includes('TOTAL AMOUNT FOB') || textoFila.includes('TOTAL UNITS')) break
    // Fallback: si col[6] o col[5] contiene "TOTAL AMOUNT" (no es sub-header)
    if (String(row[6] || row[5] || '').toUpperCase().includes('TOTAL AMOUNT')) break

    if (!row.some(c => c !== null && c !== '')) continue

    const qty = parseNum(row[0])
    if (!qty || qty <= 0) continue

    const codigo = String(row[2] || '').trim()
    const desc = String(row[3] || row[4] || '').trim()
    const fobUnit = parseNum(row[colPrecio])
    const fobTotal = parseNum(row[colTotal])

    if (codigo || desc) {
      lineas.push({
        codigo_tangshan: codigo,
        descripcion: desc || codigo,
        cantidad: Math.round(qty),
        precio_fob_usd: fobUnit,
        subtotal_fob: fobTotal ?? (fobUnit && qty ? fobUnit * qty : null),
      })
    }
  }

  return { numero, fecha, lineas, formato: 'hoja1' }
}

/**
 * Parser para formato "Sheet2" (puertas / ventanas):
 *   [0]=Item NO, [1]=Description, [2]=Size, [3]=Price/FOB, [4]=QTY, [5]=Total Amount
 */
function parsearSheet2(rows, nombreArchivo) {
  const numero = extraerNumero(nombreArchivo)
  const fecha = detectarFecha(rows)

  // Buscar fila con "Itme NO." o "Item NO." en col[0]
  let headerRow = -1
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const cell0 = String(rows[i]?.[0] || '').toUpperCase()
    if (cell0.includes('ITEM') || cell0.includes('ITME')) {
      headerRow = i
      break
    }
  }
  if (headerRow < 0) headerRow = 0  // asumir primera fila

  const lineas = []
  let codigoActual = ''
  let descActual = ''

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] || []
    if (!row.some(c => c !== null && c !== '')) continue

    // Si col[0] tiene texto (código) → actualizar código activo
    if (row[0] && typeof row[0] === 'string') {
      codigoActual = String(row[0]).trim()
      descActual = String(row[1] || '').trim()
    }

    const size = String(row[2] || '').trim()
    const fobPrice = parseNum(row[3])
    const qty = parseNum(row[4])

    if (fobPrice && (codigoActual || descActual)) {
      lineas.push({
        codigo_tangshan: codigoActual,
        descripcion: `${descActual} ${size}`.trim(),
        variante: size,
        cantidad: qty ? Math.round(qty) : null,
        precio_fob_usd: fobPrice,
        subtotal_fob: parseNum(row[5]),
      })
    }
  }

  return { numero, fecha, lineas, formato: 'sheet2' }
}

/**
 * Parsea cualquier PI de Emily, probando los formatos conocidos.
 * Retorna null si el formato no es reconocido.
 */
function parsearPI(ruta) {
  const buffer = fs.readFileSync(ruta)
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const nombreArchivo = path.basename(ruta)

  // Intentar Hoja1 primero (formato estándar Tangshan)
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

    const tieneHoja1 = sheetName.toLowerCase().includes('hoja') ||
                       sheetName.toLowerCase().includes('sheet') ||
                       wb.SheetNames.length === 1

    // Detectar si tiene estructura Hoja1 (QUANTITY en col[0])
    const hasQuantityHeader = rows.some(r => String(r?.[0] || '').toUpperCase().trim() === 'QUANTITY')

    if (hasQuantityHeader) {
      const resultado = parsearHoja1(rows, nombreArchivo)
      if (resultado && resultado.lineas.length > 0) return resultado
    }

    // Detectar si tiene estructura Sheet2 (Item NO en col[0] de la primera fila)
    const primeraFilaConDatos = rows.find(r => r && r.some(c => c !== null))
    const esSheet2 = primeraFilaConDatos &&
      String(primeraFilaConDatos[0] || '').toUpperCase().includes('ITEM') ||
      String(primeraFilaConDatos?.[0] || '').toUpperCase().includes('ITME')

    if (esSheet2) {
      const resultado = parsearSheet2(rows, nombreArchivo)
      if (resultado && resultado.lineas.length > 0) return resultado
    }
  }

  // No reconocido
  return null
}

// ────────────────────────────────────────────────────────────────────────────────
// LÓGICA DE MATCHING Y ACTUALIZACIÓN
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Construye mapa código → precio desde líneas del PI.
 * Para códigos con variante ("T007L-70 W"), agrupa por base code y usa el primer precio.
 * Asume que variantes del mismo producto tienen el mismo FOB.
 */
function construirMapaPrecios(lineas) {
  const exact = new Map()   // código exacto → precio
  const prefix = new Map()  // código base (sin variante) → precio (primer encontrado)

  for (const l of lineas) {
    if (!l.codigo_tangshan || !l.precio_fob_usd) continue
    const code = l.codigo_tangshan.toUpperCase().trim()
    exact.set(code, l.precio_fob_usd)

    // Guardar también la primera parte del código (sin variante al final)
    const parts = code.split(' ')
    if (parts.length > 1) {
      const base = parts[0]
      if (!prefix.has(base)) prefix.set(base, l.precio_fob_usd)
    }
  }

  return { exact, prefix }
}

function buscarPrecio(codigoDB, mapas) {
  const key = (codigoDB || '').toUpperCase().trim()
  if (!key) return null
  // 1. Match exacto
  if (mapas.exact.has(key)) return mapas.exact.get(key)
  // 2. El DB code es prefijo de algún PI code (base sin variante)
  if (mapas.prefix.has(key)) return mapas.prefix.get(key)
  // 3. Algún PI code empieza con el DB code
  for (const [piCode, price] of mapas.exact) {
    if (piCode.startsWith(key + ' ') || piCode.startsWith(key + '-')) {
      return price
    }
  }
  return null
}

// ────────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────────

const stats = {
  archivos: 0,
  lineasActualizadas: 0,
  historialActualizado: 0,
  sinProformaEnDB: [],
  noParseables: [],
  sinMatchCodigo: [],
}

async function main() {
  const archivos = fs.readdirSync(CARPETA_PI).filter(f => /\.(xlsx|xls)$/i.test(f))
  console.log(`Archivos PI encontrados: ${archivos.length}\n`)

  for (const archivo of archivos) {
    const ruta = path.join(CARPETA_PI, archivo)
    console.log(`${'='.repeat(60)}`)
    console.log(`Procesando: ${archivo}`)

    let datosPI = null
    try {
      datosPI = parsearPI(ruta)
    } catch (e) {
      console.warn(`  ERROR al parsear: ${e.message}`)
    }

    if (!datosPI) {
      console.warn(`  SKIP: formato no reconocido (merged cells o estructura especial)`)
      stats.noParseables.push(archivo)
      continue
    }

    const { numero, fecha, lineas, formato } = datosPI
    stats.archivos++

    console.log(`  Formato: ${formato}`)
    console.log(`  Número: ${numero || 'NO DETECTADO'}`)
    console.log(`  Fecha: ${fecha || 'no detectada'}`)
    console.log(`  Líneas PI: ${lineas.length}`)

    if (!numero) {
      console.warn(`  SKIP: no se pudo detectar número de proforma`)
      stats.sinProformaEnDB.push(`SIN_NUMERO (${archivo})`)
      continue
    }

    // Buscar proforma en DB
    const { data: proforma } = await supabase
      .from('proformas')
      .select('id, numero, cliente_id, modo_pricing')
      .eq('numero', numero)
      .single()

    if (!proforma) {
      console.warn(`  SKIP: proforma ${numero} no encontrada en DB`)
      stats.sinProformaEnDB.push(`${numero} (${archivo})`)
      continue
    }

    console.log(`  Proforma DB: id=${proforma.id}, modo=${proforma.modo_pricing}`)

    // Construir mapas de precio
    const mapas = construirMapaPrecios(lineas)
    console.log(`  Códigos exactos en PI: ${mapas.exact.size}, bases: ${mapas.prefix.size}`)

    // Obtener líneas sin costo de la proforma
    const { data: lineasDB } = await supabase
      .from('proforma_lineas')
      .select('id, codigo_pdf, descripcion_pdf, precio_costo_usd, precio_cliente_usd, cantidad')
      .eq('proforma_id', proforma.id)

    if (!lineasDB) {
      console.error(`  ERROR obteniendo líneas de proforma`)
      continue
    }

    const sinCosto = lineasDB.filter(l => !l.precio_costo_usd)
    console.log(`  Líneas DB: ${lineasDB.length} total, ${sinCosto.length} sin costo`)

    let actualizadasEstaProforma = 0
    for (const ldb of sinCosto) {
      const fobPrice = buscarPrecio(ldb.codigo_pdf, mapas)

      if (!fobPrice) {
        stats.sinMatchCodigo.push(`${numero}/${ldb.codigo_pdf || ldb.descripcion_pdf?.slice(0, 30)}`)
        continue
      }

      const margen = ldb.precio_cliente_usd ? ldb.precio_cliente_usd / fobPrice - 1 : null
      const subtotalCosto = fobPrice * (ldb.cantidad || 1)

      if (DRY_RUN) {
        console.log(`    [DRY] ${ldb.codigo_pdf}: costo=$${fobPrice} margen=${margen != null ? (margen * 100).toFixed(1) + '%' : 'n/a'}`)
        actualizadasEstaProforma++
        stats.lineasActualizadas++
        continue
      }

      const { error } = await supabase
        .from('proforma_lineas')
        .update({ precio_costo_usd: fobPrice, margen_pct: margen, subtotal_costo_usd: subtotalCosto })
        .eq('id', ldb.id)

      if (error) {
        console.error(`    ERROR linea ${ldb.id}: ${error.message}`)
      } else {
        console.log(`    ✓ ${ldb.codigo_pdf}: costo=$${fobPrice}`)
        actualizadasEstaProforma++
        stats.lineasActualizadas++
      }
    }

    // Actualizar historial_precios
    const { data: historial } = await supabase
      .from('historial_precios')
      .select('id, codigo_pdf, descripcion_pdf, precio_costo_usd, precio_cliente_usd')
      .eq('proforma_id', proforma.id)
      .is('precio_costo_usd', null)

    if (historial && historial.length > 0) {
      for (const h of historial) {
        const fobPrice = buscarPrecio(h.codigo_pdf, mapas)
        if (!fobPrice) continue

        const margen = h.precio_cliente_usd ? h.precio_cliente_usd / fobPrice - 1 : null

        if (DRY_RUN) {
          stats.historialActualizado++
          continue
        }

        const { error } = await supabase
          .from('historial_precios')
          .update({ precio_costo_usd: fobPrice, margen_pct: margen })
          .eq('id', h.id)

        if (!error) stats.historialActualizado++
      }
      console.log(`  Historial actualizado: ${stats.historialActualizado} entradas`)
    }

    console.log(`  → ${actualizadasEstaProforma} líneas actualizadas para ${numero}`)
  }

  // ── RESUMEN ──
  console.log('\n' + '='.repeat(60))
  console.log('RESUMEN FINAL')
  console.log('='.repeat(60))
  console.log(`Archivos parseados: ${stats.archivos}`)
  console.log(`Líneas proforma_lineas actualizadas: ${stats.lineasActualizadas}`)
  console.log(`Entradas historial_precios actualizadas: ${stats.historialActualizado}`)

  if (stats.noParseables.length > 0) {
    console.log(`\nFormato no reconocido — requieren revisión manual (${stats.noParseables.length}):`)
    stats.noParseables.forEach(f => console.log(`  ⚠  ${f}`))
  }

  if (stats.sinProformaEnDB.length > 0) {
    console.log(`\nProformas no en DB — pueden ser órdenes nuevas (${stats.sinProformaEnDB.length}):`)
    stats.sinProformaEnDB.forEach(p => console.log(`  -  ${p}`))
  }

  if (stats.sinMatchCodigo.length > 0) {
    console.log(`\nCódigos sin match en PI (${stats.sinMatchCodigo.length}):`)
    stats.sinMatchCodigo.forEach(r => console.log(`  -  ${r}`))
  }
}

main().catch(err => {
  console.error('ERROR FATAL:', err)
  process.exit(1)
})
