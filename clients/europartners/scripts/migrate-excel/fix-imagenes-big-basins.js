/**
 * Copia la única foto del Excel de Big Basins (BIG BASIN PRICE LIST.xls,
 * convertido a .xlsx vía Excel COM automation) a los 10 tamaños que no la
 * tenían. Confirmado con Jero (2026-07-29): es genéricamente la misma foto
 * para todos los tamaños de este modelo — el Excel solo trae UNA imagen en
 * total (image1.png, 27541 bytes), ya cargada para 802-80; el resto de filas
 * no tienen ningún anchor propio.
 *
 * Uso: node fix-imagenes-big-basins.js           (dry-run)
 *      node fix-imagenes-big-basins.js --write   (aplica de verdad)
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WRITE = process.argv.includes('--write')

const BASE = '802-80'
const VARIANTES = ['802-60', '802-70', '802-75', '802-80LR', '802-90', '802-90LR', '802-100', '802-100LR', '802-120', '802-120LR']

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

  const { data: baseProd } = await admin.from('productos').select('codigo, imagen_url').eq('codigo', BASE).single()
  if (!baseProd?.imagen_url) { console.log(`✗ ${BASE}: no encontrado o sin imagen_url en BD`); return }
  const basePath = storagePathFromUrl(baseProd.imagen_url)
  const carpeta = path.dirname(basePath)
  const ext = path.extname(basePath)

  let buffer = null
  if (WRITE) {
    const { data: fileData, error: dlErr } = await admin.storage.from('productos').download(basePath)
    if (dlErr) { console.log(`✗ error descargando ${basePath}: ${dlErr.message}`); return }
    buffer = Buffer.from(await fileData.arrayBuffer())
  }

  for (const codigo of VARIANTES) {
    const { data: prod, error } = await admin.from('productos').select('id, codigo').eq('codigo', codigo).single()
    if (error || !prod) { console.log(`  ✗ ${codigo}: no encontrado en BD`); continue }

    const destPath = `${carpeta}/${codigo}${ext}`
    console.log(`  ${codigo.padEnd(12)} ← copia de ${BASE} (${basePath}) → ${destPath}`)
    if (!WRITE) continue

    const { error: upErr } = await admin.storage.from('productos').upload(destPath, buffer, {
      contentType: ext === '.jpeg' || ext === '.jpg' ? 'image/jpeg' : 'image/png',
      upsert: true,
    })
    if (upErr) { console.log(`     ✗ error subiendo: ${upErr.message}`); continue }

    const { data: urlData } = admin.storage.from('productos').getPublicUrl(destPath)
    const { error: updErr } = await admin.from('productos').update({ imagen_url: urlData.publicUrl }).eq('id', prod.id)
    if (updErr) console.log(`     ✗ subido pero falló update: ${updErr.message}`)
    else console.log(`     ✓ hecho`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
