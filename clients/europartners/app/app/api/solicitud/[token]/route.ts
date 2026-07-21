import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

type Params = { params: { token: string } }

// Ruta pública — el cliente accede desde su link fijo de pedido, sin login.
// Nunca expone precio_fob_usd (costo de Emily) ni ningún dato de margen.
export async function GET(_req: NextRequest, { params }: Params) {
  const adminClient = createAdminClient()

  const { data: cliente } = await adminClient
    .from('clientes')
    .select('id, nombre, activo')
    .eq('token_solicitud', params.token)
    .single()

  if (!cliente || !cliente.activo) {
    return NextResponse.json({ error: 'Enlace inválido' }, { status: 404 })
  }

  const { data: categorias } = await adminClient
    .from('categorias_producto')
    .select('id, nombre, orden')
    .order('orden', { ascending: true })

  const { data: productos } = await adminClient
    .from('productos')
    .select('id, categoria_id, codigo, nombre, descripcion, imagen_url')
    .eq('estado', 'activo')
    .order('categoria_id', { ascending: true })
    .order('codigo', { ascending: true })

  return NextResponse.json({
    cliente: { id: cliente.id, nombre: cliente.nombre },
    categorias: categorias || [],
    productos: productos || [],
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const adminClient = createAdminClient()

  const { data: cliente } = await adminClient
    .from('clientes')
    .select('id, nombre, activo')
    .eq('token_solicitud', params.token)
    .single()

  if (!cliente || !cliente.activo) {
    return NextResponse.json({ error: 'Enlace inválido' }, { status: 404 })
  }

  const body = await req.json()
  const lineas = Array.isArray(body.lineas) ? body.lineas : []
  const notasCliente = typeof body.notas_cliente === 'string' ? body.notas_cliente : null

  if (lineas.length === 0) {
    return NextResponse.json({ error: 'Agrega al menos un producto' }, { status: 400 })
  }

  for (const l of lineas) {
    if (!l.producto_id && !l.descripcion_libre?.trim()) {
      return NextResponse.json({ error: 'Cada línea necesita un producto o una descripción' }, { status: 400 })
    }
    if (!l.cantidad || Number(l.cantidad) <= 0) {
      return NextResponse.json({ error: 'Cantidad inválida en una de las líneas' }, { status: 400 })
    }
  }

  const { data: solicitud, error } = await adminClient
    .from('solicitudes')
    .insert({ cliente_id: cliente.id, notas_cliente: notasCliente, estado: 'pendiente' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const lineasInsert = lineas.map((l: { producto_id?: string; descripcion_libre?: string; cantidad: number; notas?: string }) => ({
    solicitud_id: solicitud.id,
    producto_id: l.producto_id || null,
    descripcion_libre: l.descripcion_libre || null,
    cantidad: Number(l.cantidad),
    notas: l.notas || null,
  }))

  await adminClient.from('solicitud_lineas').insert(lineasInsert)

  // Notificar a todo el equipo de operaciones (Deisy)
  const { data: operativos } = await adminClient
    .from('usuarios')
    .select('id')
    .eq('rol', 'operaciones')
    .eq('activo', true)

  if (operativos && operativos.length > 0) {
    await adminClient.from('notificaciones').insert(
      operativos.map(u => ({
        usuario_id: u.id,
        tipo: 'solicitud_nueva',
        mensaje: `Nueva solicitud de ${cliente.nombre} (${lineas.length} línea${lineas.length !== 1 ? 's' : ''})`,
      }))
    )
  }

  return NextResponse.json({ ok: true, solicitud_id: solicitud.id }, { status: 201 })
}
