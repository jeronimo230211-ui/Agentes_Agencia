import { leerExcel, getSheetRows, extraerNumeroProforma, parsearFecha, parseNum, rowText } from './common.js'

/**
 * Parsea una proforma de cliente o PI de Tangshan.
 * Ambos archivos usan el mismo template:
 *   col[0]=qty, col[1]="SETS", col[2]=codigo, col[3]=descripcion,
 *   col[8]=precio_unitario, col[10]=total_amount
 * Los totales están en col[7] (label) y col[10] (valor) al final.
 */
export function parsearProformaCliente(ruta) {
  const wb = leerExcel(ruta)
  if (!wb) return null

  const rows = getSheetRows(wb)
  if (!rows.length) return null

  // 1. Número de proforma (primeras 6 filas, suele estar en col[10])
  let numero = null
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    const n = extraerNumeroProforma(rowText(rows[i]))
    if (n) { numero = n; break }
  }

  // 2. Fecha — buscar serial Excel o texto de fecha en primeras 10 filas
  let fecha = null
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    for (const cell of (rows[i] || [])) {
      const f = parsearFecha(cell)
      if (f && f > '2020-01-01' && f < '2030-01-01') { fecha = f; break }
    }
    if (fecha) break
  }

  // 3. Encontrar fila de encabezado: tiene "QUANTITY" en col[0]
  let headerRow = -1
  for (let i = 0; i < rows.length; i++) {
    const cell0 = String(rows[i]?.[0] || '').toUpperCase().trim()
    if (cell0 === 'QUANTITY' || cell0 === 'QTY') {
      headerRow = i
      break
    }
  }

  // 4. Extraer líneas de productos
  const lineas = []
  if (headerRow >= 0) {
    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i] || []

      // Parar cuando encontramos la fila de totales (col[7] tiene "TOTAL AMOUNT")
      const col7 = String(row[7] || '').toUpperCase()
      if (col7.includes('TOTAL AMOUNT') || col7.includes('TOTAL UNITS')) break

      const qty = parseNum(row[0])
      if (!qty || qty <= 0) continue

      // Saltar si primera col es texto (encabezado repetido o subtítulo)
      if (isNaN(Number(row[0])) && typeof row[0] === 'string') continue

      const codigo = String(row[2] || '').trim()
      const descripcion = String(row[3] || '').trim()
      const precioUnit = parseNum(row[8])
      const total = parseNum(row[10])

      if (!codigo && !descripcion) continue

      lineas.push({
        cantidad: Math.round(qty),
        codigo_pdf: codigo,
        descripcion_pdf: descripcion || codigo,
        precio_cliente_usd: precioUnit,
        subtotal_cliente_usd: total ?? (precioUnit && qty ? precioUnit * qty : null),
      })
    }
  }

  // 5. Totales FOB/CIF (col[7] = label, col[10] = valor)
  let totalFob = null, flete = null, totalCif = null
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || []
    const label = String(row[7] || '').toUpperCase()
    const valor = parseNum(row[10])
    if (!valor) continue
    if (label.includes('TOTAL AMOUNT FOB') || label.includes('TOTAL AMOUNT CIF')) {
      if (!totalFob) totalFob = valor
    }
    if (label.includes('FREIGHT')) flete = valor
    if (label.includes('TOTAL') && (label.includes('CIF') || label.includes('CFR'))) {
      totalCif = valor
    }
  }

  if (!totalFob && lineas.length > 0) {
    totalFob = lineas.reduce((s, l) => s + (l.subtotal_cliente_usd || 0), 0) || null
  }

  return {
    numero,
    fecha,
    lineas,
    total_fob_usd: totalFob,
    total_flete_usd: flete,
    total_cif_usd: totalCif ?? (totalFob && flete ? totalFob + flete : totalFob),
  }
}
