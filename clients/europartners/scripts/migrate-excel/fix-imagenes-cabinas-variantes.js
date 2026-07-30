/**
 * Copia la imagen del código base a sus variantes de tamaño/color en
 * Shower Enclosures y Bathtubs (2026-07-29).
 *
 * Confirmado contra "precios cabinas de ducha y bañeras (JERO).xlsx": el
 * Excel ancla UNA imagen por xdr:twoCellAnchor que abarca varias filas
 * consecutivas (un modelo con 2-5 tamaños/colores comparte la misma foto,
 * por eso el script original de carga (cargar-cabinas-toilets-voltage.js)
 * solo asignó imagen a la primera fila del grupo -01/-03, dejando las
 * demás -02/-04/-05/-06 sin imagen). Verificado 1:1 en bytes contra el
 * anchor de cada grupo antes de aplicar.
 *
 * Uso: node fix-imagenes-cabinas-variantes.js           (dry-run)
 *      node fix-imagenes-cabinas-variantes.js --write   (aplica de verdad)
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WRITE = process.argv.includes('--write')

const PARES = [
  ['E2A-2-01', 'E2A-2-02'],
  ['E2A-2-03', 'E2A-2-04'],
  ['E2A-1-01', 'E2A-1-02'],
  ['E2A-1-03', 'E2A-1-04'],
  ['E15A-4-01', 'E15A-4-02'],
  ['E15A-4-01', 'E15A-4-03'],
  ['E15A-4-04', 'E15A-4-05'],
  ['E15A-4-04', 'E15A-4-06'],
  ['ODS-8036A-01', 'ODS-8036A-02'],
  ['D-9003S-01', 'D-9003S-02'],
  ['D-9003S-01', 'D-9003S-03'],
  ['D-9003S-01', 'D-9003S-04'],
  ['D-9003S-01', 'D-9003S-05'],
  ['S5-3-ARC-ANGEL-CHROME-01', 'S5-3-ARC-ANGEL-BLACK-01'],
]

const envPath = path.join(__dirname, '..', '..', 'app', '.env.local')
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

function storagePathFromUrl(url) {
  const m = url.match(/\/object\/public\/productos\/(.+)$/)
  return m ? decodeURIComponent(m[1]) : null
}

async function main() {
  console.log(`Modo: ${WRITE ? 'ESCRITURA REAL' : 'DRY-RUN (usa --write para aplicar)'}\n`)

  for (const [base, variante] of PARES) {
    const { data: baseProd, error: e1 } = await admin.from('productos').select('codigo, imagen_url').eq('codigo', base).single()
    if (e1 || !baseProd?.imagen_url) { console.log(`  ✗ ${base}: no encontrado o sin imagen_url en BD`); continue }

    const { data: varProd, error: e2 } = await admin.from('productos').select('id, codigo').eq('codigo', variante).single()
    if (e2 || !varProd) { console.log(`  ✗ ${variante}: no encontrado en BD`); continue }

    const basePath = storagePathFromUrl(baseProd.imagen_url)
    if (!basePath) { console.log(`  ✗ ${base}: URL con formato inesperado`); continue }

    const carpeta = path.dirname(basePath)
    const ext = path.extname(basePath)
    const destPath = `${carpeta}/${variante}${ext}`

    console.log(`  ${variante.padEnd(26)} ← copia de ${base} (${basePath}) → ${destPath}`)

    if (!WRITE) continue

    const { data: fileData, error: dlErr } = await admin.storage.from('productos').download(basePath)
    if (dlErr) { console.log(`     ✗ error descargando ${basePath}: ${dlErr.message}`); continue }
    const buffer = Buffer.from(await fileData.arrayBuffer())

    const { error: upErr } = await admin.storage.from('productos').upload(destPath, buffer, {
      contentType: ext === '.jpeg' || ext === '.jpg' ? 'image/jpeg' : 'image/png',
      upsert: true,
    })
    if (upErr) { console.log(`     ✗ error subiendo: ${upErr.message}`); continue }

    const { data: urlData } = admin.storage.from('productos').getPublicUrl(destPath)
    const { error: updErr } = await admin.from('productos').update({ imagen_url: urlData.publicUrl }).eq('id', varProd.id)
    if (updErr) console.log(`     ✗ subido pero falló update: ${updErr.message}`)
    else console.log(`     ✓ hecho`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
