import { NextResponse } from 'next/server'
import { getCurrentUsuario } from '@/lib/auth'

// GET /api/mis-pendientes — cola de acción de Marta (admin): proformas por
// aprobar, pagos pendientes de confirmar y despachos sin completar, cada uno
// con las horas transcurridas desde que entró a ese estado.
export async function GET() {
  const ctx = await getCurrentUsuario()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (ctx.usuario.rol !== 'admin') return NextResponse.json({ error: 'Solo admin' }, { status: 403 })

  const { supabase } = ctx
  const ahora = Date.now()
  const horasDesde = (iso: string | null | undefined) =>
    iso ? Math.round(((ahora - new Date(iso).getTime()) / 3_600_000) * 10) / 10 : null

  // ── 1. Proformas en_revision — tiempo desde que entraron a ese estado ──
  const { data: enRevision } = await supabase
    .from('proformas')
    .select('id, numero, total_fob_usd, total_cif_usd, updated_at, cliente:clientes(nombre)')
    .eq('estado', 'en_revision')

  const eventosPorProforma = new Map<string, string>()
  if (enRevision?.length) {
    const ids = enRevision.map(p => p.id)
    const { data: eventos } = await supabase
      .from('proforma_eventos')
      .select('proforma_id, created_at')
      .eq('estado_hacia', 'en_revision')
      .in('proforma_id', ids)
      .order('created_at', { ascending: false })
    // El primer evento encontrado por proforma_id (orden desc) es el más reciente
    for (const ev of eventos || []) {
      if (!eventosPorProforma.has(ev.proforma_id)) eventosPorProforma.set(ev.proforma_id, ev.created_at)
    }
  }

  const proformasEnRevision = (enRevision || [])
    .map(p => ({
      id: p.id,
      numero: p.numero,
      cliente: (p.cliente as { nombre?: string } | null)?.nombre || null,
      total: p.total_cif_usd ?? p.total_fob_usd ?? null,
      desde: eventosPorProforma.get(p.id) || p.updated_at,
      horas: horasDesde(eventosPorProforma.get(p.id) || p.updated_at),
    }))
    .sort((a, b) => (b.horas ?? 0) - (a.horas ?? 0))

  // ── 2. Pagos pendientes de confirmar (proformas ya enviadas al cliente) ──
  const { data: pagos } = await supabase
    .from('proformas')
    .select('id, numero, total_fob_usd, total_cif_usd, estado_pago, fecha_envio_cliente, created_at, cliente:clientes(nombre)')
    .in('estado_pago', ['pendiente', 'parcial'])
    .in('estado', ['aprobada', 'enviada'])

  const pagosPendientes = (pagos || [])
    .map(p => ({
      id: p.id,
      numero: p.numero,
      cliente: (p.cliente as { nombre?: string } | null)?.nombre || null,
      total: p.total_cif_usd ?? p.total_fob_usd ?? null,
      estado_pago: p.estado_pago,
      desde: p.fecha_envio_cliente || p.created_at,
      horas: horasDesde(p.fecha_envio_cliente || p.created_at),
    }))
    .sort((a, b) => (b.horas ?? 0) - (a.horas ?? 0))

  // ── 3. Despachos sin completar ──
  const { data: despachos } = await supabase
    .from('despachos')
    .select('id, naviera, numero_bl, estado, estado_at, created_at, proforma:proformas(numero, cliente:clientes(nombre))')
    .neq('estado', 'entregado')

  const despachosPendientes = (despachos || [])
    .map(d => {
      const proforma = d.proforma as { numero?: string; cliente?: { nombre?: string } | null } | null
      return {
        id: d.id,
        numero_proforma: proforma?.numero || null,
        cliente: proforma?.cliente?.nombre || null,
        naviera: d.naviera,
        estado: d.estado,
        desde: d.estado_at || d.created_at,
        horas: horasDesde(d.estado_at || d.created_at),
      }
    })
    .sort((a, b) => (b.horas ?? 0) - (a.horas ?? 0))

  return NextResponse.json({
    en_revision: proformasEnRevision,
    pago_pendiente: pagosPendientes,
    despachos_pendientes: despachosPendientes,
  })
}
