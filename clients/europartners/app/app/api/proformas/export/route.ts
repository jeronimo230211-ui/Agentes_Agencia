import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import * as XLSX from 'xlsx'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fechaCorta(iso: string | null) {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function totalPf(p: { total_cif_usd: number | null; total_fob_usd: number | null }) {
  return p.total_cif_usd ?? p.total_fob_usd ?? null
}

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const cliente_id = searchParams.get('cliente_id')
  const estado     = searchParams.get('estado')
  const año        = searchParams.get('año')
  const mes        = searchParams.get('mes')

  // ── Mismos filtros que la lista ──
  let query = supabase
    .from('proformas')
    .select(`
      id, numero, numero_cliente, fecha, fecha_vencimiento,
      incoterm, modo_pricing, estado,
      total_fob_usd, total_cif_usd, notas_internas,
      cliente:clientes(nombre, pais),
      lineas:proforma_lineas(
        orden, descripcion_pdf, codigo_pdf, cantidad,
        precio_costo_usd, precio_cliente_usd, margen_pct,
        subtotal_costo_usd, subtotal_cliente_usd
      )
    `)
    .order('fecha', { ascending: false })
    .order('numero', { ascending: false })

  if (cliente_id) query = query.eq('cliente_id', cliente_id)
  if (estado)     query = query.eq('estado', estado)
  if (año) {
    const y = parseInt(año)
    if (mes) {
      const m = parseInt(mes)
      const desde = `${y}-${String(m).padStart(2, '0')}-01`
      const hasta = new Date(y, m, 0).toISOString().split('T')[0]
      query = query.gte('fecha', desde).lte('fecha', hasta)
    } else {
      query = query.gte('fecha', `${y}-01-01`).lte('fecha', `${y}-12-31`)
    }
  }

  const { data: proformas, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!proformas?.length) return NextResponse.json({ error: 'Sin datos para exportar' }, { status: 404 })

  // ── Hoja 1: Resumen de proformas ──
  const encResumen = [
    'Proforma', 'Ref. Cliente', 'Cliente', 'Fecha', 'Vencimiento',
    'Incoterm', 'Estado', '# Líneas', 'Total USD', 'Notas',
  ]

  const filasResumen = proformas.map(p => [
    p.numero,
    p.numero_cliente ?? '',
    (p.cliente as { nombre?: string } | null)?.nombre ?? '',
    fechaCorta(p.fecha),
    fechaCorta(p.fecha_vencimiento),
    p.incoterm,
    p.estado.replace('_', ' '),
    p.lineas?.length ?? 0,
    totalPf(p) ?? '',
    p.notas_internas ?? '',
  ])

  const wsResumen = XLSX.utils.aoa_to_sheet([encResumen, ...filasResumen])
  wsResumen['!cols'] = [
    { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 12 },
    { wch: 9  }, { wch: 12 }, { wch: 8  }, { wch: 13 }, { wch: 30 },
  ]
  wsResumen['!freeze'] = { xSplit: 0, ySplit: 1 }

  // Estilo encabezado resumen
  for (let c = 0; c < encResumen.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (wsResumen[addr]) {
      wsResumen[addr].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
        fill: { fgColor: { rgb: '1E3A5F' } },
        alignment: { horizontal: 'center' },
      }
    }
  }

  // Formato moneda en columna Total
  filasResumen.forEach((_, i) => {
    const addr = XLSX.utils.encode_cell({ r: i + 1, c: 8 })
    if (wsResumen[addr]?.v) wsResumen[addr].z = '#,##0.00'
  })

  // ── Hoja 2: Detalle de líneas ──
  const encDetalle = [
    'Proforma', 'Cliente', 'Fecha', 'Estado',
    'Código', 'Descripción', 'Cantidad',
    'Costo China', 'Precio Cliente', 'Margen %',
    'Subtotal Costo', 'Subtotal Cliente',
  ]

  const filasDetalle: (string | number)[][] = []
  for (const p of proformas) {
    for (const l of (p.lineas ?? []).sort((a: { orden: number }, b: { orden: number }) => a.orden - b.orden)) {
      filasDetalle.push([
        p.numero,
        (p.cliente as { nombre?: string } | null)?.nombre ?? '',
        fechaCorta(p.fecha),
        p.estado.replace('_', ' '),
        l.codigo_pdf ?? '',
        l.descripcion_pdf ?? '',
        l.cantidad ?? '',
        l.precio_costo_usd ?? '',
        l.precio_cliente_usd ?? '',
        l.margen_pct != null ? Number((l.margen_pct * 100).toFixed(2)) : '',
        l.subtotal_costo_usd ?? '',
        l.subtotal_cliente_usd ?? '',
      ])
    }
  }

  const wsDetalle = XLSX.utils.aoa_to_sheet([encDetalle, ...filasDetalle])
  wsDetalle['!cols'] = [
    { wch: 10 }, { wch: 20 }, { wch: 11 }, { wch: 12 },
    { wch: 12 }, { wch: 38 }, { wch: 8  },
    { wch: 13 }, { wch: 14 }, { wch: 10 },
    { wch: 14 }, { wch: 15 },
  ]
  wsDetalle['!freeze'] = { xSplit: 0, ySplit: 1 }

  for (let c = 0; c < encDetalle.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (wsDetalle[addr]) {
      wsDetalle[addr].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
        fill: { fgColor: { rgb: '1E3A5F' } },
        alignment: { horizontal: 'center' },
      }
    }
  }

  // Formato numérico en columnas de precio
  filasDetalle.forEach((_, i) => {
    const r = i + 1
    for (const c of [7, 8, 10, 11]) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (wsDetalle[addr]?.v) wsDetalle[addr].z = '#,##0.00'
    }
    const margenAddr = XLSX.utils.encode_cell({ r, c: 9 })
    if (wsDetalle[margenAddr]?.v) wsDetalle[margenAddr].z = '0.00"%"'
  })

  // ── Ensamblar workbook ──
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Proformas')
  XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle de Líneas')

  // Nombre del archivo refleja los filtros activos
  const partes = ['Europartners_Proformas']
  if (año) partes.push(año)
  if (mes) partes.push(MESES[parseInt(mes) - 1])
  if (estado) partes.push(estado)
  const nombreArchivo = `${partes.join('_')}.xlsx`

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer', cellStyles: true })

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    },
  })
}
