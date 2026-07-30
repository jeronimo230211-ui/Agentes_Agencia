/**
 * Corrige las imágenes rotas de Laundry Sinks (LAUN-001 a LAUN-005).
 *
 * Causa (encontrada 2026-07-29): el Excel fuente (PRICE LIST LAUNDRY  JERO.xlsx)
 * tiene anchors de dibujo duplicados por fila — cada fila de LAUN-001..006 quedó
 * con 2 imágenes ancladas (una real, una versión rota de 137-140 bytes dejada
 * por una edición previa en Excel). La extracción original de julio se quedó
 * con la imagen rota para 5 de los 9 productos. LAUN-006/008/009 ya están
 * correctos (quedaron con la imagen buena por casualidad del orden de los
 * anchors) y LAUN-007 genuinamente no tiene imagen en el Excel — ninguno de
 * los tres se toca aquí.
 *
 * Lección para futuras cargas: si un producto sale con imagen "rota" (unos
 * pocos cientos de bytes, técnicamente sube y resuelve HTTP 200 pero está
 * vacía/corrupta), revisar si xl/drawings/drawingN.xml tiene más de un anchor
 * para esa fila — Excel a veces deja anchors duplicados de ediciones viejas
 * sin borrarlos, y el más reciente en el XML no siempre es el bueno.
 *
 * Uso: node fix-imagenes-laundry.js           (dry-run, solo muestra el plan)
 *      node fix-imagenes-laundry.js --write   (sube de verdad)
 */
import AdmZip from 'adm-zip'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WRITE = process.argv.includes('--write')

const ARCHIVO = 'C:/Users/Jeronimo/OneDrive/EUROPARTNERS/CHINA/THANSHAN/LISTA DE PRECIO THANSANG/LAUNDRY/PRICE LIST LAUNDRY  JERO.xlsx'

// Mapeo confirmado a mano contra xl/drawings/drawing1.xml + xl/drawings/_rels —
// para cada código, cuál xl/media/imageN.ext es la foto real (no la rota).
const MAPEO = {
  'LAUN-001': 'image10.png',
  'LAUN-002': 'image1.png',
  'LAUN-003': 'image2.png',
  'LAUN-004': 'image11.png',
  'LAUN-005': 'image3.png',
}

const envPath = path.join(__dirname, '..', '..', 'app', '.env.local')
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

async function main() {
  const zip = new AdmZip(ARCHIVO)

  console.log(`Modo: ${WRITE ? 'ESCRITURA REAL' : 'DRY-RUN (usa --write para subir de verdad)'}\n`)

  const paquetes = []
  for (const [codigo, archivoMedia] of Object.entries(MAPEO)) {
    const data = zip.readFile(`xl/media/${archivoMedia}`)
    if (!data) {
      console.log(`  ⚠️  ${codigo}: no se encontró xl/media/${archivoMedia} en el Excel`)
      continue
    }
    if (data.length < 1000) {
      console.log(`  ⚠️  ${codigo}: xl/media/${archivoMedia} también es sospechosamente chico (${data.length} bytes) — revisar a mano, no se sube`)
      continue
    }
    const ext = path.extname(archivoMedia)
    console.log(`  ${codigo} ← ${archivoMedia} (${data.length} bytes) → Storage: Laundry Sinks/${codigo}${ext}`)
    paquetes.push({ codigo, ext, data })
  }

  if (!WRITE) {
    console.log(`\n${paquetes.length} imágenes listas para subir. Vuelve a correr con --write para aplicar.`)
    return
  }

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

  for (const { codigo, ext, data } of paquetes) {
    const destino = `Laundry Sinks/${codigo}${ext}`
    const { error: upErr } = await admin.storage.from('productos').upload(destino, data, {
      contentType: ext === '.png' ? 'image/png' : 'image/jpeg',
      upsert: true,
    })
    if (upErr) {
      console.log(`  ✗ ${codigo}: error subiendo — ${upErr.message}`)
      continue
    }

    const { data: urlData } = admin.storage.from('productos').getPublicUrl(destino)
    const { error: updErr } = await admin
      .from('productos')
      .update({ imagen_url: urlData.publicUrl })
      .eq('codigo', codigo)

    if (updErr) {
      console.log(`  ✗ ${codigo}: subido pero falló update en productos — ${updErr.message}`)
    } else {
      console.log(`  ✓ ${codigo}: subido y productos.imagen_url actualizado`)
    }
  }

  console.log('\nListo. Verifica en /catalogo que las 5 imágenes se vean bien.')
}

main().catch(e => { console.error(e); process.exit(1) })
