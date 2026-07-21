import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

type Params = { params: { id: string } }

const CAMPOS_EDITABLES = [
  'naviera', 'numero_bl', 'puerto_origen', 'puerto_destino',
  'fecha_despacho', 'fecha_llegada_estimada', 'fecha_llegada_real',
  'shipping_fee_usd', 'estado', 'picking_descripcion', 'notas',
]

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('despachos')
    .select(`
      *,
      proforma:proformas(*, cliente:clientes(*))
    `)
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const campo of CAMPOS_EDITABLES) {
    if (campo in body) update[campo] = body[campo]
  }

  if ('estado' in body) {
    const { data: actual } = await supabase.from('despachos').select('estado, fecha_llegada_real').eq('id', params.id).single()

    // estado_at mide "tiempo en el estado actual" — solo se toca cuando el
    // estado realmente cambia, no en cualquier edición (a diferencia de updated_at)
    if (actual && actual.estado !== body.estado) {
      update.estado_at = new Date().toISOString()
    }

    if (update.estado === 'entregado' && !actual?.fecha_llegada_real && !update.fecha_llegada_real) {
      update.fecha_llegada_real = new Date().toISOString().split('T')[0]
    }
  }

  const { data, error } = await supabase
    .from('despachos')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
