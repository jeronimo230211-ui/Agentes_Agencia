import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const cliente_id = searchParams.get('cliente_id')
  const estado     = searchParams.get('estado')
  const año        = searchParams.get('año')
  const mes        = searchParams.get('mes')
  const limit      = Math.min(parseInt(searchParams.get('limit') || '200'), 500)

  let query = supabase
    .from('proformas')
    .select(`
      id, numero, numero_cliente, fecha, fecha_vencimiento,
      incoterm, modo_pricing, estado, estado_pago,
      total_fob_usd, total_cif_usd,
      cliente:clientes(id, nombre, slug, incoterm),
      lineas:proforma_lineas(count)
    `)
    .order('fecha', { ascending: false })
    .order('numero', { ascending: false })
    .limit(limit)

  if (cliente_id) query = query.eq('cliente_id', cliente_id)
  if (estado)     query = query.eq('estado', estado)

  // Filtro por año y mes usando rango de fechas
  if (año) {
    const y = parseInt(año)
    if (mes) {
      const m = parseInt(mes)
      const desde = `${y}-${String(m).padStart(2, '0')}-01`
      const hasta = new Date(y, m, 0).toISOString().split('T')[0] // último día del mes
      query = query.gte('fecha', desde).lte('fecha', hasta)
    } else {
      query = query.gte('fecha', `${y}-01-01`).lte('fecha', `${y}-12-31`)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { cliente_id, parametros_precio_id } = body

  if (!cliente_id) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

  // Obtener cliente para copiar incoterm y modo_pricing por defecto
  const { data: cliente } = await supabase
    .from('clientes')
    .select('incoterm, modo_pricing')
    .eq('id', cliente_id)
    .single()

  const { data, error } = await supabase
    .from('proformas')
    .insert({
      cliente_id,
      parametros_precio_id,
      creada_por: session.user.id,
      incoterm: cliente?.incoterm || 'FOB',
      modo_pricing: cliente?.modo_pricing || 'set',
      estado: 'borrador',
      fecha: new Date().toISOString().split('T')[0],
      fecha_vencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    })
    .select(`*, cliente:clientes(*), lineas:proforma_lineas(*)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
