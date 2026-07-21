import * as XLSX from 'xlsx'

const ruta = 'C:/Users/Jeronimo/OneDrive/EUROPARTNERS/CHINA/THANSHAN/JAMAICA/E&R HARDWARE/PROFORMA/2025/PROFORMA 3-0153 GYPSUM/PROFORMA 3-0153 E^0R HARDWARE GYPSUM.xlsx'

const wb = XLSX.readFile(ruta, { cellFormula: false, cellHTML: false })
console.log('Hojas:', wb.SheetNames)
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
rows.forEach((r, i) => {
  const vals = r.filter(v => v !== null && v !== '')
  if (vals.length > 0) console.log(`Fila ${i}:`, JSON.stringify(r))
})
