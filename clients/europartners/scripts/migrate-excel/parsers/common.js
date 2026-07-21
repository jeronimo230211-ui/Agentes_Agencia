import fs from 'fs'
import XLSX from 'xlsx'

export function leerArchivo(ruta) {
  try {
    const stats = fs.statSync(ruta)
    if (stats.size === 0) {
      console.warn(`  SKIP (placeholder no descargado): ${ruta}`)
      return null
    }
    return fs.readFileSync(ruta)
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn(`  SKIP (no encontrado): ${ruta}`)
    } else {
      console.error(`  ERROR leyendo ${ruta}: ${err.message}`)
    }
    return null
  }
}

export function leerExcel(ruta) {
  const buffer = leerArchivo(ruta)
  if (!buffer) return null
  try {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    return wb
  } catch (err) {
    console.error(`  ERROR parseando Excel ${ruta}: ${err.message}`)
    return null
  }
}

export function getSheetRows(wb, sheetIndex = 0) {
  const sheetName = wb.SheetNames[sheetIndex]
  if (!sheetName) return []
  const ws = wb.Sheets[sheetName]
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
}

// Extrae número de proforma de un string (nombre de archivo o carpeta)
export function extraerNumeroProforma(str) {
  const match = str.match(/3-(\d{3,4})/)
  return match ? `3-${match[1]}` : null
}

// Extrae fecha de string como "March 31, 2022" o "2022-03-31"
export function parsearFecha(str) {
  if (!str) return null
  if (typeof str === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(str)
    if (date) return `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`
  }
  const s = String(str).trim()
  // Try common formats
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0]
  }
  return null
}

// Intenta parsear un número del value de una celda
export function parseNum(val) {
  if (val === null || val === undefined || val === '') return null
  const n = parseFloat(String(val).replace(/,/g, ''))
  return isNaN(n) ? null : n
}

// Convierte fila a texto limpio para búsquedas
export function rowText(row) {
  return (row || []).map(c => String(c || '')).join(' ').trim()
}
