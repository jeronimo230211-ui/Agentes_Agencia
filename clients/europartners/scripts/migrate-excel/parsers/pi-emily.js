import { leerExcel, getSheetRows, extraerNumeroProforma, parsearFecha, parseNum, rowText } from './common.js'

/**
 * Parsea un PI (Purchase Invoice) de Emily — Tangshan.
 * Extrae: número de orden, fecha, productos con código Tangshan, precio FOB, CBM.
 */
export function parsearPIEmily(ruta) {
  const wb = leerExcel(ruta)
  if (!wb) return null

  const rows = getSheetRows(wb)
  if (!rows.length) return null

  // Detectar tipo especial: "PI FOR DOORS" (proveedor diferente)
  const esDoors = rowText(rows[0] || []).toUpperCase().includes('DOOR')
  const esVerificacion = ruta.toLowerCase().includes('verificar') || ruta.toLowerCase().includes('comparison')

  if (esVerificacion) {
    return parsearVerificacion(rows, ruta)
  }

  // Número de orden
  let numero = null
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    const n = extraerNumeroProforma(rowText(rows[i]))
    if (n) { numero = n; break }
  }

  // Fecha
  let fecha = null
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    for (const cell of (rows[i] || [])) {
      const f = parsearFecha(cell)
      if (f && f > '2020-01-01') { fecha = f; break }
    }
    if (fecha) break
  }

  // Detectar header: buscar fila con "QUANTITY" en col[0] (mismo template que proforma)
  // El header puede estar hasta la fila 25 en este template de Tangshan
  let headerRow = -1
  for (let i = 0; i < rows.length; i++) {
    const cell0 = String(rows[i]?.[0] || '').toUpperCase().trim()
    if (cell0 === 'QUANTITY' || cell0 === 'QTY') {
      headerRow = i
      break
    }
  }

  // Fallback para PI puertas: busca "ITEM" + "DESC"
  if (esDoors && headerRow === -1) {
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const text = rowText(rows[i]).toUpperCase()
      if (text.includes('ITEM') && text.includes('DESC')) {
        headerRow = i
        break
      }
    }
  }

  const lineas = []
  if (headerRow >= 0) {
    let codigoActual = ''
    let descActual = ''
    let colorActual = ''

    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i] || []

      // Parar en la fila de totales (col[7] tiene "TOTAL AMOUNT")
      const col7 = String(row[7] || '').toUpperCase()
      if (col7.includes('TOTAL AMOUNT') || col7.includes('TOTAL UNITS')) break

      if (!row.some(c => c !== null && c !== '')) continue

      if (esDoors) {
        // Formato: [ITEM_NO, DESC, PIC, COLOR, SIZE_INCHES, SIZE_CM, QTY, FOB_PRICE, TOT_AMOUNT, CBM, TOT_CBM, PRECIO_CLIENTE, TOT_CLIENTE]
        if (row[0]) { codigoActual = String(row[0]).trim(); descActual = String(row[1] || '').trim() }
        if (row[3]) { colorActual = String(row[3]).trim() }

        const qty = parseNum(row[6])
        const size = String(row[4] || '').trim()
        const fobPrice = parseNum(row[7])
        const cbm = parseNum(row[9])
        const precioCliente = parseNum(row[11])

        if (qty && fobPrice) {
          lineas.push({
            codigo_tangshan: codigoActual,
            descripcion: `${descActual} ${colorActual} ${size}`.trim(),
            variante: size || colorActual,
            cantidad: Math.round(qty),
            precio_fob_usd: fobPrice,
            cbm_unitario: cbm,
            precio_cliente_usd: precioCliente,
          })
        }
      } else {
        // Formato estándar Tangshan (mismo template que proforma):
        // col[0]=qty, col[1]="SETS", col[2]=codigo, col[3]=descripcion,
        // col[8]=precio_unitario_fob, col[10]=total_fob
        const qty = parseNum(row[0])
        if (!qty || qty <= 0) continue
        if (isNaN(Number(row[0])) && typeof row[0] === 'string') continue

        const codigo = String(row[2] || '').trim()
        const desc = String(row[3] || '').trim()
        const fobUnit = parseNum(row[8])
        const fobTotal = parseNum(row[10])

        if (codigo || desc) {
          lineas.push({
            codigo_tangshan: codigo,
            descripcion: desc || codigo,
            cantidad: Math.round(qty),
            precio_fob_usd: fobUnit,
            subtotal_fob: fobTotal ?? (fobUnit && qty ? fobUnit * qty : null),
          })
        }
      }
    }
  }

  return { numero, fecha, lineas, esDoors }
}

/**
 * Parsea archivo "verificar precios" — tiene doble columna: China vs Cliente
 * Columnas típicas: [DESC, QTY, PRECIO_CHINA, PRECIO_CLIENTE, NUEVO_PRECIO]
 */
function parsearVerificacion(rows, ruta) {
  const numero = extraerNumeroProforma(ruta)
  const lineas = []

  // Buscar fila con "China" y "cliente"
  let headerRow = -1
  for (let i = 0; i < rows.length; i++) {
    const text = rowText(rows[i]).toLowerCase()
    if (text.includes('china') || text.includes('precio')) {
      headerRow = i
      break
    }
  }

  if (headerRow < 0) return { numero, lineas, esVerificacion: true }

  // Detectar índices de columnas
  const header = (rows[headerRow] || []).map(c => String(c || '').toLowerCase())
  const idxChina = header.findIndex(h => h.includes('china') || h.includes('costo'))
  const idxCliente = header.findIndex(h => h.includes('cliente') || h.includes('venta'))
  const idxDesc = header.findIndex(h => h.includes('desc') || h.includes('product'))
  const idxQty = header.findIndex(h => h.includes('qty') || h.includes('cant'))

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] || []
    if (!row.some(c => c !== null && c !== '')) continue
    const firstText = String(row[0] || '').toUpperCase()
    if (firstText.includes('TOTAL')) break

    const desc = String(row[idxDesc >= 0 ? idxDesc : 0] || '').trim()
    const pChina = idxChina >= 0 ? parseNum(row[idxChina]) : null
    const pCliente = idxCliente >= 0 ? parseNum(row[idxCliente]) : null
    const qty = idxQty >= 0 ? parseNum(row[idxQty]) : null

    if (pChina || pCliente) {
      lineas.push({
        descripcion: desc,
        cantidad: qty ? Math.round(qty) : 1,
        precio_costo_usd: pChina,
        precio_cliente_usd: pCliente,
        margen_pct: pChina && pCliente ? (pCliente / pChina - 1) : null,
      })
    }
  }

  return { numero, lineas, esVerificacion: true }
}
