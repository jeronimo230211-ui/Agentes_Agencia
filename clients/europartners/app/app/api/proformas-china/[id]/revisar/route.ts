import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

type Params = { params: { id: string } }

// Aprueba/rechaza línea por línea una proforma de China (Emily) — al
// aprobar una línea, actualiza productos.precio_fob_usd con lo que ella
// propuso. Piloto: solo actualiza el costo del catálogo, no genera
// automático un borrador de proforma cliente (decisión de Jero, 2026-08-27
// — se puede sumar después sin rehacer nada de esto).
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await req.json()
  const decisiones = Array.isArray(body.lineas) ? body.lineas : []
  if (decisiones.length === 0) {
    return NextResponse.json({ error: 'No hay líneas para revisar' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data: proformaChina } = await adminClient
    .from('proformas_china')
    .select('id, estado')
    .eq('id', params.id)
    .single()

  if (!proformaChina) return NextResponse.json({ error: 'Proforma no encontrada' }, { status: 404 })
  if (proformaChina.estado !== 'enviada') {
    return NextResponse.json({ error: 'Esta proforma ya fue revisada' }, { status: 400 })
  }

  for (const d of decisiones as { id: string; decision: 'aprobada' | 'rechazada' }[]) {
    if (!['aprobada', 'rechazada'].includes(d.decision)) continue

    const { data: linea } = await adminClient
      .from('proformas_china_lineas')
      .select('id, producto_id, precio_fob_propuesto, proforma_china_id')
      .eq('id', d.id)
      .eq('proforma_china_id', params.id)
      .single()

    if (!linea) continue

    await adminClient
      .from('proformas_china_lineas')
      .update({ estado_linea: d.decision })
      .eq('id', linea.id)

    if (d.decision === 'aprobada') {
      await adminClient
        .from('productos')
        .update({ precio_fob_usd: linea.precio_fob_propuesto, updated_at: new Date().toISOString() })
        .eq('id', linea.producto_id)
    }
  }

  const { data: lineasRestantes } = await adminClient
    .from('proformas_china_lineas')
    .select('estado_linea')
    .eq('proforma_china_id', params.id)

  const todasResueltas = (lineasRestantes || []).every(l => l.estado_linea !== 'pendiente')
  if (todasResueltas) {
    const hayAprobadas = (lineasRestantes || []).some(l => l.estado_linea === 'aprobada')
    await adminClient
      .from('proformas_china')
      .update({
        estado: hayAprobadas ? 'aprobada' : 'rechazada',
        revisada_por: session.user.id,
        revisada_at: new Date().toISOString(),
      })
      .eq('id', params.id)
  }

  return NextResponse.json({ ok: true })
}
