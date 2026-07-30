/**
 * Sincroniza la columna "Tiene foto" del FINAL con el estado real de
 * productos.imagen_url en Supabase (2026-07-29) — después de corregir todas
 * las imágenes faltantes/rotas del catálogo (183/183 con foto), la columna
 * del Excel seguía diciendo "No" para muchas de ellas.
 *
 * Uso: node sync-tiene-foto.js           (dry-run)
 *      node sync-tiene-foto.js --write   (aplica de verdad)
 */
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WRITE = process.argv.includes('--write')

const FINAL = 'C:/Users/Jeronimo/OneDrive/Europartners_BD/BD_Catalogo_EUP/Europartners_Analisis_Catalogo_2026-07-05_FINAL (1) (1).xlsx'
const HOJA = '📦 Catálogo Consolidado'
const COL_CODIGO = 0
const COL_FOTO = 15

const envPath = path.join(__dirname, '..', '..', 'app', '.env.local')
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

async function main() {
  console.log(`Modo: ${WRITE ? 'ESCRITURA REAL' : 'DRY-RUN (usa --write para aplicar)'}\n`)

  const { data: productos } = await admin.from('productos').select('codigo, imagen_url')
  const conFoto = new Set(productos.filter(p => p.imagen_url).map(p => p.codigo))
  console.log(`Supabase: ${productos.length} productos, ${conFoto.size} con imagen_url\n`)

  const wb = XLSX.read(fs.readFileSync(FINAL), { type: 'buffer', cellStyles: true })
  const ws = wb.Sheets[HOJA]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  let actualizados = 0
  let noEncontrados = []

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const codigo = r?.[COL_CODIGO]
    if (!codigo) continue

    const yaDiceSi = String(r[COL_FOTO] || '').trim().toLowerCase() === 'sí' || String(r[COL_FOTO] || '').trim().toLowerCase() === 'si'
    const tieneFotoReal = conFoto.has(String(codigo))

    if (!tieneFotoReal) {
      if (yaDiceSi) console.log(`  ⚠️  ${codigo}: Excel dice "Sí" pero Supabase NO tiene imagen_url — revisar`)
      continue
    }
    if (yaDiceSi) continue // ya está correcto

    console.log(`  ${String(codigo).padEnd(16)} No → Sí`)
    actualizados++
    if (!WRITE) continue

    const addr = XLSX.utils.encode_cell({ r: i, c: COL_FOTO })
    ws[addr] = { t: 's', v: 'Sí' }
  }

  console.log(`\n${actualizados} filas a actualizar.`)

  if (!WRITE) {
    console.log('Vuelve a correr con --write para aplicar.')
    return
  }

  XLSX.writeFile(wb, FINAL, { bookSST: false, type: 'file', cellStyles: true })
  console.log('✓ Archivo guardado:', FINAL)
}

main().catch(e => { console.error(e); process.exit(1) })
