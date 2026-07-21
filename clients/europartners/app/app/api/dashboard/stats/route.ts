import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

interface EventoRow {
  proforma_id: string
  estado_desde: string | null
  estado_hacia: string
  created_at: string
}

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  // ── Conteos por estado (sobre toda la tabla, no solo una página) ──
  let proformasQuery = supabase.from('proformas').select('id, estado, fecha, total_fob_usd, total_cif_usd, created_at')
  if (desde) proformasQuery = proformasQuery.gte('fecha', desde)
  if (hasta) proformasQuery = proformasQuery.lte('fecha', hasta)
  const { data: proformas } = await proformasQuery

  const conteos: Record<string, number> = {}
  let facturacionTotal = 0
  for (const p of proformas || []) {
    conteos[p.estado] = (conteos[p.estado] || 0) + 1
    if (p.estado === 'enviada' || p.estado === 'facturada') {
      facturacionTotal += p.total_cif_usd ?? p.total_fob_usd ?? 0
    }
  }

  // ── OTIF ──
  let despachosQuery = supabase
    .from('despachos')
    .select('fecha_llegada_estimada, fecha_llegada_real')
    .eq('estado', 'entregado')
    .not('fecha_llegada_estimada', 'is', null)
    .not('fecha_llegada_real', 'is', null)
  if (desde) despachosQuery = despachosQuery.gte('fecha_llegada_real', desde)
  if (hasta) despachosQuery = despachosQuery.lte('fecha_llegada_real', hasta)
  const { data: despachosEntregados } = await despachosQuery

  const totalEntregados = despachosEntregados?.length ?? 0
  const aTiempo = (despachosEntregados || []).filter(d => d.fecha_llegada_real! <= d.fecha_llegada_estimada!).length
  const otifPct = totalEntregados > 0 ? aTiempo / totalEntregados : null

  // ── Tiempos por etapa (a partir de proforma_eventos) ──
  const { data: eventos } = await supabase
    .from('proforma_eventos')
    .select('proforma_id, estado_desde, estado_hacia, created_at')
    .order('proforma_id', { ascending: true })
    .order('created_at', { ascending: true })

  const creadaEn = new Map((proformas || []).map(p => [p.id, p.created_at]))
  const duraciones: Record<string, number[]> = {}
  const porProforma = new Map<string, EventoRow[]>()

  for (const ev of (eventos || []) as EventoRow[]) {
    if (!porProforma.has(ev.proforma_id)) porProforma.set(ev.proforma_id, [])
    porProforma.get(ev.proforma_id)!.push(ev)
  }

  for (const [proformaId, evs] of Array.from(porProforma.entries())) {
    let anterior = creadaEn.get(proformaId)
    for (const ev of evs) {
      if (anterior) {
        const horas = (new Date(ev.created_at).getTime() - new Date(anterior).getTime()) / 3_600_000
        if (horas >= 0) {
          const etiqueta = `${ev.estado_desde ?? '—'} → ${ev.estado_hacia}`
          if (!duraciones[etiqueta]) duraciones[etiqueta] = []
          duraciones[etiqueta].push(horas)
        }
      }
      anterior = ev.created_at
    }
  }

  const tiemposPorEtapa = Object.entries(duraciones).map(([etapa, horas]) => ({
    etapa,
    promedio_horas: horas.reduce((a, b) => a + b, 0) / horas.length,
    muestras: horas.length,
  }))

  // ── Pipeline (solicitudes + proformas + despachos) ──
  const { count: solicitudesPendientes } = await supabase
    .from('solicitudes')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'pendiente')

  const { data: despachosPorEstado } = await supabase
    .from('despachos')
    .select('estado')

  const despachosConteo: Record<string, number> = {}
  for (const d of despachosPorEstado || []) {
    despachosConteo[d.estado] = (despachosConteo[d.estado] || 0) + 1
  }

  return NextResponse.json({
    conteos,
    facturacion_total: facturacionTotal,
    otif: { total_entregados: totalEntregados, a_tiempo: aTiempo, pct: otifPct },
    tiempos_por_etapa: tiemposPorEtapa,
    pipeline: {
      solicitudes_pendientes: solicitudesPendientes ?? 0,
      proformas: conteos,
      despachos: despachosConteo,
    },
  })
}
