import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('solicitudes')
    .select(`
      *,
      cliente:clientes(*),
      lineas:solicitud_lineas(*, producto:productos(*))
    `)
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

// Permite marcar una solicitud como descartada (con motivo en notas_cliente/notas internas
// no aplica aquí — el rechazo formal ocurre a nivel de proforma, no de solicitud)
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { estado } = await req.json()
  if (!['revisada', 'descartada'].includes(estado)) {
    return NextResponse.json({ error: 'Estado no permitido' }, { status: 400 })
  }

  const { data: current } = await supabase
    .from('solicitudes')
    .select('estado')
    .eq('id', params.id)
    .single()

  if (!current || current.estado === 'convertida') {
    return NextResponse.json({ error: 'La solicitud ya fue convertida en proforma' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('solicitudes')
    .update({ estado, revisada_por: session.user.id, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
