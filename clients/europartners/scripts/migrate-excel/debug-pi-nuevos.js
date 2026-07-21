/**
 * Inspecciona la estructura raw de cada PI nuevo para diagnosticar problemas de parsing.
 * Uso: node debug-pi-nuevos.js [nombre_parcial]
 */
import fs from 'fs'
import path from 'path'
import XLSX from 'xlsx'

const CARPETA = 'C:/Users/Jeronimo/OneDrive/EUROPARTNERS/CHINA/THANSHAN/JAMAICA/PROFORMAS PARA BASE DE DATOS'
const filtro = process.argv[2] || ''

const archivos = fs.readdirSync(CARPETA)
  .filter(f => /\.(xlsx|xls)$/i.test(f))
  .filter(f => !filtro || f.toLowerCase().includes(filtro.toLowerCase()))

for (const archivo of archivos) {
  const ruta = path.join(CARPETA, archivo)
  console.log(`\n${'='.repeat(70)}`)
  console.log(`ARCHIVO: ${archivo}`)
  console.log('='.repeat(70))

  const buffer = fs.readFileSync(ruta)
  const wb = XLSX.read(buffer, { type: 'buffer' })

  console.log(`Hojas: ${wb.SheetNames.join(', ')}`)

  for (const sheetName of wb.SheetNames.slice(0, 2)) {
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
    console.log(`\n  [Hoja: ${sheetName}] — ${rows.length} filas`)

    // Mostrar primeras 30 filas con contenido
    let mostradas = 0
    for (let i = 0; i < rows.length && mostradas < 35; i++) {
      const row = rows[i] || []
      if (!row.some(c => c !== null && c !== '')) continue
      const preview = row.map((c, j) => `[${j}]=${JSON.stringify(c)}`).join(' | ')
      console.log(`  fila ${String(i).padStart(2,'0')}: ${preview}`)
      mostradas++
    }
  }
}
