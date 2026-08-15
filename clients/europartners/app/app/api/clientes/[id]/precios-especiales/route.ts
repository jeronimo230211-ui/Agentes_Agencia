import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

type Params = { params: { id: string } }

// Precios fijados a mano para un cliente puntual en un producto puntual —
// ver migración 012. Se resuelven antes que productos.precio_mayorista/
// precio_detallista tanto en el link de autoservicio del cliente como en
// el cotizador manual.
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('precios_especiales_cliente')
    .select('id, producto_id, precio_usd, motivo, created_at, producto:productos(codigo, descripcion)')
    .eq('cliente_id', params.id)
    .eq('activo', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// Fija un precio especial nuevo. Si ya existe uno activo para el mismo
// (cliente, producto), lo desactiva primero en vez de sobreescribirlo —
// así queda historial de quién cambió qué precio y cuándo.
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const codigo = (body.codigo as string | undefined)?.trim()
  let producto_id = body.producto_id as string | undefined
  const precio_usd = Number(body.precio_usd)
  const motivo = (body.motivo as string | undefined)?.trim() || null

  if (!precio_usd || precio_usd <= 0) {
    return NextResponse.json({ error: 'Ingresa un precio válido' }, { status: 400 })
  }
  if (!producto_id && !codigo) {
    return NextResponse.json({ error: 'Falta el producto' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  if (!producto_id && codigo) {
    const { data: producto } = await adminClient.from('productos').select('id').eq('codigo', codigo).maybeSingle()
    if (!producto) return NextResponse.json({ error: `No existe ningún producto con código "${codigo}" en el catálogo` }, { status: 404 })
    producto_id = producto.id
  }

  // RLS de precios_especiales_cliente solo permite escritura a service_role.
  await adminClient
    .from('precios_especiales_cliente')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('cliente_id', params.id)
    .eq('producto_id', producto_id!)
    .is('componente_id', null)
    .eq('activo', true)

  const { data, error } = await adminClient
    .from('precios_especiales_cliente')
    .insert({
      cliente_id: params.id,
      producto_id,
      precio_usd,
      motivo,
      creado_por: session.user.id,
    })
    .select('id, producto_id, precio_usd, motivo, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
