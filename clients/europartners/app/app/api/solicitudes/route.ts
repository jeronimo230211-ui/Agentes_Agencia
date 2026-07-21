import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const estado = searchParams.get('estado')
  const cliente_id = searchParams.get('cliente_id')

  let query = supabase
    .from('solicitudes')
    .select(`
      *,
      cliente:clientes(id, nombre, slug),
      lineas:solicitud_lineas(*, producto:productos(id, codigo, nombre, imagen_url))
    `)
    .order('created_at', { ascending: false })

  if (estado) query = query.eq('estado', estado)
  if (cliente_id) query = query.eq('cliente_id', cliente_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
