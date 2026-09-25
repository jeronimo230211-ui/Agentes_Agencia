import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUsuario } from '@/lib/auth'

// Registro Maestro Vivo — Fase 3 (módulo Finanzas). Reemplaza la hoja Excel
// "REGISTRO MASTER": lista de proformas cruzada con su deuda en vivo
// (proformas_deuda_vivo, ver migración 021_tabla_pagos.sql) más los 4
// indicadores del tablero.
//
// Acceso: admin + analista — mismo criterio que /api/reportes/tiempos-por-usuario
// (información financiera/analítica, no la cola de acción de operaciones).
const ROLES_FINANZAS = ['admin', 'analista']

interface ProformaRow {
  id: string
  numero: string
  fecha: string
  estado: string
  estado_pago: 'pendiente' | 'parcial' | 'pagado'
  cliente_id: string
  total_fob_usd: number | null
  total_cif_usd: number | null
  notas_internas: string | null
}

interface DespachoResumen {
  proforma_id: string
  naviera: string | null
  booking_no: string | null
  fecha_llegada_estimada: string | null
  fecha_llegada_real: string | null
  // shipping_fee_usd: monto de referencia que carga operaciones a mano en el
  // despacho (schema_v2.sql) — se expone acá solo como referencia junto al
  // historial real de pagos de flete (tabla `pagos`, tipo='flete', ver
  // migración 024_pago_flete_despacho.sql), que se lee aparte con
  // HistorialPagos en el drawer.
  id: string
  shipping_fee_usd: number | null
}

interface DeudaVivoRow {
  proforma_id: string
  numero: string
  total_facturado_cliente_usd: number
  pagado_cliente_usd: number
  deuda_cliente_usd: number
  pagado_china_usd: number
  deuda_china_usd: number | null
}

type EstadoDeuda = 'sin_deuda' | 'pendiente' | 'parcial' | 'pagado'

export async function GET(req: NextRequest) {
  const ctx = await getCurrentUsuario()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!ROLES_FINANZAS.includes(ctx.usuario.rol)) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }
  const { supabase } = ctx

  const { searchParams } = new URL(req.url)
  const año = searchParams.get('año')
  const cliente_id = searchParams.get('cliente_id')
  const pais = searchParams.get('pais')
  const estadoDeudaFiltro = searchParams.get('estado_deuda') as EstadoDeuda | null

  // Clientes: fuente de nombre/país para cruzar en JS (mismo enfoque simple
  // que ya usan las páginas de la app — sin filtros embebidos de PostgREST).
  const { data: clientes } = await supabase.from('clientes').select('id, nombre, pais').order('nombre')
  const clientePorId = new Map((clientes || []).map(c => [c.id, c]))
  const idsClientesPais = pais ? new Set((clientes || []).filter(c => c.pais === pais).map(c => c.id)) : null

  let query = supabase
    .from('proformas')
    // notas_internas: mismo campo que ya usa cotizador/[id] y el flujo de
    // aprobación — se expone acá como "Observaciones" de solo lectura.
    .select('id, numero, fecha, estado, estado_pago, cliente_id, total_fob_usd, total_cif_usd, notas_internas')
    .order('fecha', { ascending: false })
    .limit(1000)

  if (cliente_id) query = query.eq('cliente_id', cliente_id)
  if (año) query = query.gte('fecha', `${año}-01-01`).lte('fecha', `${año}-12-31`)

  const { data: proformasRaw, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let proformas = (proformasRaw || []) as ProformaRow[]
  if (idsClientesPais) proformas = proformas.filter(p => idsClientesPais.has(p.cliente_id))

  if (proformas.length === 0) {
    return NextResponse.json({
      data: [],
      indicadores: { facturado: 0, ganancia: 0, deuda_cliente_total: 0, deuda_china_total: 0 },
    })
  }

  const ids = proformas.map(p => p.id)

  // Deuda en vivo (vista, ver migración 021)
  const { data: deudaRows } = await supabase
    .from('proformas_deuda_vivo')
    .select('*')
    .in('proforma_id', ids)
  const deudaPorId = new Map(((deudaRows || []) as DeudaVivoRow[]).map(d => [d.proforma_id, d]))

  // Despacho (naviera/booking/ETA/llegada real) — join simple por
  // proforma_id, mismo patrón que ya usa `proforma_lineas` en otros endpoints.
  // Una proforma puede no tener despacho todavía (el drawer muestra "—").
  const { data: despachosRows } = await supabase
    .from('despachos')
    .select('id, proforma_id, naviera, booking_no, fecha_llegada_estimada, fecha_llegada_real, shipping_fee_usd')
    .in('proforma_id', ids)
  const despachoPorProforma = new Map(
    ((despachosRows || []) as DespachoResumen[]).map(d => [d.proforma_id, d])
  )

  // Fecha de factura final — no existe una columna dedicada en `proformas`;
  // se deriva del evento estado_hacia='facturada' en proforma_eventos (ver
  // POST /api/aprobacion-cliente, que lo inserta cuando el cliente aprueba).
  // Si una proforma llegó a facturarse más de una vez, se toma la primera fecha.
  const { data: eventosFacturada } = await supabase
    .from('proforma_eventos')
    .select('proforma_id, created_at')
    .eq('estado_hacia', 'facturada')
    .in('proforma_id', ids)
    .order('created_at', { ascending: true })
  const fechaFacturaPorProforma = new Map<string, string>()
  for (const e of (eventosFacturada || []) as { proforma_id: string; created_at: string }[]) {
    if (!fechaFacturaPorProforma.has(e.proforma_id)) fechaFacturaPorProforma.set(e.proforma_id, e.created_at)
  }

  // Costo real (para Ganancia) — solo proformas facturadas al cliente, mismo
  // criterio de "facturación" que usa /api/dashboard/stats (estado enviada
  // o facturada). Se sacan de proforma_lineas.subtotal_costo_usd, que ya se
  // persiste ahí (ver PUT /api/proformas/[id]) — no es un cálculo nuevo.
  const idsFacturacion = proformas.filter(p => p.estado === 'enviada' || p.estado === 'facturada').map(p => p.id)
  const costoPorProforma = new Map<string, number>()
  if (idsFacturacion.length > 0) {
    const { data: lineas } = await supabase
      .from('proforma_lineas')
      .select('proforma_id, subtotal_costo_usd')
      .in('proforma_id', idsFacturacion)
    for (const l of (lineas || []) as { proforma_id: string; subtotal_costo_usd: number | null }[]) {
      costoPorProforma.set(l.proforma_id, (costoPorProforma.get(l.proforma_id) || 0) + (l.subtotal_costo_usd || 0))
    }
  }

  const filas = proformas.map(p => {
    const deuda = deudaPorId.get(p.id)
    const facturado = deuda?.total_facturado_cliente_usd ?? (p.total_cif_usd ?? p.total_fob_usd ?? 0)
    const deuda_cliente_usd = deuda?.deuda_cliente_usd ?? facturado
    const deuda_china_usd = deuda?.deuda_china_usd ?? null

    // "sin_deuda": nada facturado todavía (borrador/en_revision/aprobada sin
    // enviar) — estado_pago de proformas queda en 'pendiente' por default
    // aunque no haya nada que cobrar, así que se distingue acá para no
    // mezclar "pendiente de cobro real" con "todavía no aplica".
    const estado_deuda: EstadoDeuda = facturado <= 0 ? 'sin_deuda' : p.estado_pago
    const cliente = clientePorId.get(p.cliente_id) || null
    const _totalFobUsd = p.total_fob_usd || 0
    const _costoReal = costoPorProforma.get(p.id) || 0
    const _esFacturacion = p.estado === 'enviada' || p.estado === 'facturada'

    return {
      id: p.id,
      numero: p.numero,
      fecha: p.fecha,
      estado: p.estado,
      cliente,
      // País ya viajaba anidado en `cliente.pais` (se usa para el filtro),
      // se agrega también plano para que la tabla lo pueda mostrar por fila
      // sin tener que desanidar en el frontend.
      pais: cliente?.pais ?? null,
      facturado,
      deuda_cliente_usd,
      deuda_china_usd,
      estado_deuda,
      // Ganancia por fila (mismo criterio que el indicador agregado de abajo:
      // solo tiene sentido para proformas ya facturadas al cliente).
      ganancia: _esFacturacion ? (_totalFobUsd - _costoReal) : null,
      notas_internas: p.notas_internas || null,
      despacho: despachoPorProforma.get(p.id) || null,
      fecha_factura: fechaFacturaPorProforma.get(p.id) || null,
      _esFacturacion,
      _totalFobUsd,
      _costoReal,
    }
  })

  const filasFiltradas = estadoDeudaFiltro
    ? filas.filter(f => f.estado_deuda === estadoDeudaFiltro)
    : filas

  // Indicadores del tablero, calculados sobre el mismo set ya filtrado
  // (año/cliente/país/estado de deuda) que se devuelve para la tabla.
  const facturado = filasFiltradas
    .filter(f => f._esFacturacion)
    .reduce((sum, f) => sum + f.facturado, 0)

  // Ganancia = total facturado al cliente (sin flete, total_fob_usd — ver
  // nota de diseño) menos el costo real de las líneas. Reutiliza los
  // mismos campos que ya persiste el cotizador (subtotal_costo_usd /
  // subtotal_cliente_usd), no un cálculo de margen nuevo.
  const ganancia = filasFiltradas
    .filter(f => f._esFacturacion)
    .reduce((sum, f) => sum + (f._totalFobUsd - f._costoReal), 0)

  const deuda_cliente_total = filasFiltradas
    .filter(f => f.deuda_cliente_usd > 0)
    .reduce((sum, f) => sum + f.deuda_cliente_usd, 0)

  const deuda_china_total = filasFiltradas
    .filter(f => f.deuda_china_usd != null && f.deuda_china_usd > 0)
    .reduce((sum, f) => sum + (f.deuda_china_usd || 0), 0)

  const data = filasFiltradas.map(f => ({
    id: f.id,
    numero: f.numero,
    fecha: f.fecha,
    estado: f.estado,
    cliente: f.cliente,
    pais: f.pais,
    facturado: f.facturado,
    ganancia: f.ganancia,
    deuda_cliente_usd: f.deuda_cliente_usd,
    deuda_china_usd: f.deuda_china_usd,
    estado_deuda: f.estado_deuda,
    notas_internas: f.notas_internas,
    despacho: f.despacho,
    fecha_factura: f.fecha_factura,
  }))

  return NextResponse.json({
    data,
    indicadores: { facturado, ganancia, deuda_cliente_total, deuda_china_total },
  })
}
