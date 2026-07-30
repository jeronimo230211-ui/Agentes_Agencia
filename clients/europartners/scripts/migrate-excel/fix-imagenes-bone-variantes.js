/**
 * Copia la imagen del producto WHITE base a su variante -BONE cuando el Excel
 * fuente no trae una foto real distinta para el color BONE (2026-07-29).
 *
 * Confirmado contra UPDATED PRICE LIST FOR TOILETS (2026.7.6) JERO.xlsx:
 * - TP-V2-BONE, TT-1290-BONE, TT-1390-BONE, TT-8819-BONE, TT-1506-BONE tenían
 *   una imagen "cargada" pero era basura — un cartel suelto de texto
 *   "Size:508x432x200mm" reusado por error entre varias filas, no una foto.
 * - TP-23-BONE, TP-4B-BONE, y los 7 BONE de Toilets (TZ-x / HJB-x) no tienen
 *   NINGÚN anchor de imagen en el Excel — decisión de Jero (2026-07-29):
 *   mejor mostrar la foto WHITE que nada, aunque el color real sea distinto.
 *
 * Estrategia: cada código base ya tiene su imagen real y correcta en Supabase
 * Storage (verificado 1:1 contra los bytes del Excel) — se copia esa imagen
 * tal cual a la ruta del código -BONE, no hace falta volver a tocar el Excel.
 *
 * Uso: node fix-imagenes-bone-variantes.js           (dry-run)
 *      node fix-imagenes-bone-variantes.js --write   (aplica de verdad)
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WRITE = process.argv.includes('--write')

const PARES = [
  ['TP-V2', 'TP-V2-BONE'],
  ['TP-23', 'TP-23-BONE'],
  ['TP-4B', 'TP-4B-BONE'],
  ['TT-1290', 'TT-1290-BONE'],
  ['TT-1390', 'TT-1390-BONE'],
  ['TT-8819', 'TT-8819-BONE'],
  ['TT-1506', 'TT-1506-BONE'],
  ['TZ-0425HS', 'TZ-0425HS-BONE'],
  ['TZ-0425HD', 'TZ-0425HD-BONE'],
  ['TZ0420S', 'TZ0420S-BONE'],
  ['TZ-0425S', 'TZ-0425S-BONE'],
  ['TZ-3430', 'TZ-3430-BONE'],
  ['HJB-3430H', 'HJB-3430H-BONE'],
  ['TZ-0420HS', 'TZ-0420HS-BONE'],
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

  for (const [base, bone] of PARES) {
    const { data: baseProd, error: e1 } = await admin.from('productos').select('codigo, categoria_id, imagen_url').eq('codigo', base).single()
    if (e1 || !baseProd?.imagen_url) { console.log(`  ✗ ${base}: no encontrado o sin imagen_url en BD`); continue }

    const { data: boneProd, error: e2 } = await admin.from('productos').select('id, codigo, categoria_id').eq('codigo', bone).single()
    if (e2 || !boneProd) { console.log(`  ✗ ${bone}: no encontrado en BD`); continue }

    const basePath = storagePathFromUrl(baseProd.imagen_url)
    if (!basePath) { console.log(`  ✗ ${base}: URL con formato inesperado (${baseProd.imagen_url})`); continue }

    const carpeta = path.dirname(basePath)
    const ext = path.extname(basePath)
    const bonePath = `${carpeta}/${bone}${ext}`

    console.log(`  ${bone.padEnd(18)} ← copia de ${base} (${basePath}) → ${bonePath}`)

    if (!WRITE) continue

    const { data: fileData, error: dlErr } = await admin.storage.from('productos').download(basePath)
    if (dlErr) { console.log(`     ✗ error descargando ${basePath}: ${dlErr.message}`); continue }
    const buffer = Buffer.from(await fileData.arrayBuffer())

    const { error: upErr } = await admin.storage.from('productos').upload(bonePath, buffer, {
      contentType: ext === '.jpeg' || ext === '.jpg' ? 'image/jpeg' : 'image/png',
      upsert: true,
    })
    if (upErr) { console.log(`     ✗ error subiendo: ${upErr.message}`); continue }

    const { data: urlData } = admin.storage.from('productos').getPublicUrl(bonePath)
    const { error: updErr } = await admin.from('productos').update({ imagen_url: urlData.publicUrl }).eq('id', boneProd.id)
    if (updErr) console.log(`     ✗ subido pero falló update: ${updErr.message}`)
    else console.log(`     ✓ hecho`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
