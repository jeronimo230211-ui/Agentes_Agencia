import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// OTIF (on-time-in-full): % de despachos entregados cuya fecha_llegada_real
// fue igual o anterior a la fecha_llegada_estimada, dentro del rango dado.
export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  let query = supabase
    .from('despachos')
    .select('id, fecha_llegada_estimada, fecha_llegada_real')
    .eq('estado', 'entregado')
    .not('fecha_llegada_estimada', 'is', null)
    .not('fecha_llegada_real', 'is', null)

  if (desde) query = query.gte('fecha_llegada_real', desde)
  if (hasta) query = query.lte('fecha_llegada_real', hasta)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const total = data?.length ?? 0
  const aTiempo = (data || []).filter(d => d.fecha_llegada_real! <= d.fecha_llegada_estimada!).length
  const otif_pct = total > 0 ? aTiempo / total : null

  return NextResponse.json({ total, a_tiempo: aTiempo, otif_pct })
}
