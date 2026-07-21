/**
 * Debug: muestra el contenido crudo de un archivo Excel
 * Uso: node debug-excel.js "ruta/al/archivo.xlsx" [num_filas]
 */
import XLSX from 'xlsx'
import fs from 'fs'

const ruta = process.argv[2]
const maxFilas = parseInt(process.argv[3] || '30')

if (!ruta) {
  console.log('Uso: node debug-excel.js "ruta/archivo.xlsx" [num_filas]')
  process.exit(1)
}

const buffer = fs.readFileSync(ruta)
const wb = XLSX.read(buffer, { type: 'buffer' })

console.log(`\nSheets: ${wb.SheetNames.join(', ')}`)
console.log(`Usando: ${wb.SheetNames[0]}\n`)

const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

for (let i = 0; i < Math.min(maxFilas, rows.length); i++) {
  const row = rows[i]
  if (!row || !row.some(c => c !== null)) continue
  console.log(`Fila ${String(i).padStart(2,'0')}: ${row.map((c,j) => `[${j}]=${JSON.stringify(c)}`).join('  ')}`)
}
