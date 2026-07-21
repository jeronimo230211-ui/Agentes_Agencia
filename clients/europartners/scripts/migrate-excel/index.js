/**
 * Script de migración: Excel OneDrive → Supabase
 *
 * Uso:
 *   node index.js                    → migra todos los clientes
 *   node index.js --cliente hl       → solo Hardware & Lumber
 *   node index.js --dry-run          → simula sin insertar en DB
 *
 * Variables de entorno (en app/.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 *   ONEDRIVE_LOCAL_PATH
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { CLIENTES_CONFIG, PROFORMA_NUM_REGEX } from './config.js'
import { parsearProformaCliente } from './parsers/proforma-cliente.js'
import { parsearPIEmily } from './parsers/pi-emily.js'
import { getClientesMap, getParametrosPrecio, upsertProforma, ajustarSecuencia } from './loaders/supabase-loader.js'

dotenv.config({ path: path.resolve('../../app/.env.local') })

const args = process.argv.slice(2)
const clienteFiltro = args.includes('--cliente') ? args[args.indexOf('--cliente') + 1] : null
const dryRun = args.includes('--dry-run')

if (dryRun) console.log('🔍 DRY RUN — no se insertará nada en la base de datos\n')

const stats = {
  procesadas: 0,
  insertadas: 0,
  omitidas: 0,
  errores: [],
  ultimoNumero: '3-0000',
}

async function migrar() {
  const clientesMap = await getClientesMap()
  const parametros = await getParametrosPrecio()

  if (!parametros) {
    console.error('ERROR: No se encontraron parámetros de precio en Supabase. Ejecuta el seed primero.')
    process.exit(1)
  }

  const clientesAMigrar = clienteFiltro
    ? { [clienteFiltro]: CLIENTES_CONFIG[clienteFiltro] }
    : CLIENTES_CONFIG

  for (const [slug, config] of Object.entries(clientesAMigrar)) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`CLIENTE: ${config.nombre} (${config.dir})`)
    console.log('='.repeat(60))

    const clienteData = clientesMap[slug]
    if (!clienteData) {
      console.error(`  ERROR: cliente "${slug}" no encontrado en Supabase`)
      continue
    }

    if (!fs.existsSync(config.dir)) {
      console.warn(`  SKIP: directorio no existe: ${config.dir}`)
      continue
    }

    // Iterar años dentro del directorio del cliente
    const entries = fs.readdirSync(config.dir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const yearDir = path.join(config.dir, entry.name)
      await procesarDirectorioAno(yearDir, clienteData, parametros, config)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('RESUMEN DE MIGRACIÓN')
  console.log('='.repeat(60))
  console.log(`Carpetas procesadas: ${stats.procesadas}`)
  console.log(`Proformas insertadas: ${stats.insertadas}`)
  console.log(`Omitidas (ya existían o sin datos): ${stats.omitidas}`)
  if (stats.errores.length > 0) {
    console.log(`\nERRORES (${stats.errores.length}):`)
    stats.errores.forEach(e => console.log(`  - ${e}`))
  }

  if (!dryRun && stats.ultimoNumero !== '3-0000') {
    await ajustarSecuencia(stats.ultimoNumero)
    console.log(`\nSecuencia de numeración ajustada al ${stats.ultimoNumero}`)
  }
}

async function procesarDirectorioAno(yearDir, clienteData, parametros, config) {
  const entries = fs.readdirSync(yearDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const proformaDir = path.join(yearDir, entry.name)
    const proformaNum = extraerNumeroDeNombre(entry.name)

    stats.procesadas++
    console.log(`\n  Procesando: ${entry.name}`)

    // Listar archivos en la carpeta
    let files = []
    try {
      files = fs.readdirSync(proformaDir)
    } catch (e) {
      console.warn(`    ERROR leyendo directorio: ${e.message}`)
      stats.errores.push(`${entry.name}: ${e.message}`)
      continue
    }

    const xlsxFiles = files.filter(f => /\.(xlsx|xls)$/i.test(f))
    if (xlsxFiles.length === 0) {
      console.log(`    → Sin archivos Excel`)
      stats.omitidas++
      continue
    }

    // Clasificar archivos
    let archivoProforma = null
    let archivoPIEmily = null

    for (const f of xlsxFiles) {
      const lowerF = f.toLowerCase()
      if (/^pi\s+for|^pi.*emily|.*emily.*|verificar|comparison/i.test(f)) {
        archivoPIEmily = f
      } else if (/^proforma|^3-\d{3,4}/i.test(f)) {
        archivoProforma = f
      }
    }

    // Si no se detectó claramente, usar el primero
    if (!archivoProforma && !archivoPIEmily && xlsxFiles.length > 0) {
      archivoProforma = xlsxFiles[0]
    }

    // Parsear
    let datosProforma = null
    let datosPI = null

    if (archivoProforma) {
      console.log(`    Proforma: ${archivoProforma}`)
      datosProforma = parsearProformaCliente(path.join(proformaDir, archivoProforma))
    }

    if (archivoPIEmily) {
      console.log(`    PI Emily: ${archivoPIEmily}`)
      datosPI = parsearPIEmily(path.join(proformaDir, archivoPIEmily))
    }

    // Combinar datos
    const numero = datosProforma?.numero || datosPI?.numero || proformaNum
    const fecha = datosProforma?.fecha || datosPI?.fecha

    if (!numero) {
      console.warn(`    → Sin número de proforma detectado, omitiendo`)
      stats.omitidas++
      continue
    }

    console.log(`    → Número: ${numero}, Fecha: ${fecha || 'desconocida'}`)

    // Construir líneas combinadas (precio cliente + costo China cuando hay ambos)
    const lineas = construirLineas(datosProforma, datosPI)
    console.log(`    → ${lineas.length} línea(s) de producto`)

    // Actualizar último número para ajuste de secuencia
    if (numero > stats.ultimoNumero) stats.ultimoNumero = numero

    if (dryRun) {
      console.log(`    [DRY RUN] Se insertaría proforma ${numero} con ${lineas.length} líneas`)
      stats.insertadas++
      continue
    }

    const proformaId = await upsertProforma(
      clienteData.id,
      parametros.id,
      {
        numero,
        fecha,
        incoterm: config.incoterm,
        modo_pricing: config.modo_pricing,
        total_fob_usd: datosProforma?.total_fob_usd,
        total_flete_usd: datosProforma?.total_flete_usd,
        total_cif_usd: datosProforma?.total_cif_usd,
        archivo_origen: path.relative(config.dir, proformaDir),
      },
      lineas
    )

    if (proformaId) {
      console.log(`    ✓ Insertada: ${numero}`)
      stats.insertadas++
    } else {
      stats.omitidas++
    }
  }
}

function extraerNumeroDeNombre(nombre) {
  const match = nombre.match(/3-(\d{3,4})/)
  return match ? `3-${match[1]}` : null
}

/**
 * Combina líneas de proforma cliente + PI Emily.
 * Si ambos están disponibles, cruza por código para tener precio_costo + precio_cliente.
 */
function construirLineas(datosProforma, datosPI) {
  if (!datosProforma && !datosPI) return []

  const lineasCliente = datosProforma?.lineas || []
  const lineasPI = datosPI?.lineas || []

  if (lineasCliente.length === 0 && lineasPI.length === 0) return []
  if (lineasCliente.length === 0) return lineasPI
  if (lineasPI.length === 0) return lineasCliente

  // Cruzar por código cuando es posible
  const piMap = new Map()
  for (const l of lineasPI) {
    if (l.codigo_tangshan) piMap.set(l.codigo_tangshan.toUpperCase(), l)
  }

  return lineasCliente.map(lc => {
    const codigoKey = (lc.codigo_pdf || '').toUpperCase()
    const piLinea = piMap.get(codigoKey)
    return {
      ...lc,
      precio_costo_usd: piLinea?.precio_fob_usd || lc.precio_costo_usd,
      cbm_unitario: piLinea?.cbm_unitario,
      margen_pct: piLinea?.precio_fob_usd && lc.precio_cliente_usd
        ? lc.precio_cliente_usd / piLinea.precio_fob_usd - 1
        : lc.margen_pct,
    }
  })
}

migrar().catch(err => {
  console.error('ERROR FATAL:', err)
  process.exit(1)
})
