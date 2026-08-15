import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

type Params = { params: { id: string } }

// Consulta inversa de precios_especiales_cliente (ver migración 012 y
// app/api/clientes/[id]/precios-especiales/route.ts, que consulta por
// cliente) — acá se lista, para UN producto, todos los clientes que hoy
// tienen un precio especial activo en él. Usada desde el detalle del
// producto en /catalogo.
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('precios_especiales_cliente')
    .select('id, cliente_id, precio_usd, motivo, created_at, cliente:clientes(nombre)')
    .eq('producto_id', params.id)
    .eq('activo', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
