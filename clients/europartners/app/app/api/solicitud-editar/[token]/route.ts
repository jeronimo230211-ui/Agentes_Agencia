import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getCatalogoPublico } from '@/lib/catalogoPublico'

type Params = { params: { token: string } }

// Sin cookies()/headers() (createAdminClient no depende de sesión), Next.js
// cachearía el fetch a Supabase por defecto — ver nota igual en
// /api/solicitud/[token]/route.ts, mismo bug real encontrado el 2026-08-13.
export const dynamic = 'force-dynamic'

// Ruta pública — el cliente entra aquí cuando Deisy/Marta le devuelven su
// solicitud con una observación. Solo funciona mientras estado='devuelta' y
// el token no haya sido usado (se anula al reenviar).
export async function GET(_req: NextRequest, { params }: Params) {
  const adminClient = createAdminClient()

  const { data: solicitud } = await adminClient
    .from('solicitudes')
    .select(`
      id, motivo_devolucion,
      cliente:clientes(id, nombre, activo, tipo),
      lineas:solicitud_lineas(producto_id, descripcion_libre, cantidad)
    `)
    .eq('token_edicion', params.token)
    .eq('estado', 'devuelta')
    .single()

  const clienteJoin = solicitud?.cliente as { id?: string; nombre?: string; activo?: boolean; tipo?: 'mayorista' | 'detallista' } | { id?: string; nombre?: string; activo?: boolean; tipo?: 'mayorista' | 'detallista' }[] | null
  const cliente = Array.isArray(clienteJoin) ? clienteJoin[0] : clienteJoin

  if (!solicitud || !cliente?.activo) {
    return NextResponse.json({ error: 'This link is no longer valid' }, { status: 404 })
  }

  const { categorias, productos } = await getCatalogoPublico(adminClient, cliente.tipo || 'mayorista', cliente.id)

  return NextResponse.json({
    cliente: { id: cliente.id, nombre: cliente.nombre },
    motivo_devolucion: solicitud.motivo_devolucion,
    lineas: solicitud.lineas || [],
    categorias,
    productos,
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const adminClient = createAdminClient()

  const { data: solicitud } = await adminClient
    .from('solicitudes')
    .select('id, cliente:clientes(nombre)')
    .eq('token_edicion', params.token)
    .eq('estado', 'devuelta')
    .single()

  if (!solicitud) {
    return NextResponse.json({ error: 'This link is no longer valid' }, { status: 404 })
  }

  const body = await req.json()
  const lineas = Array.isArray(body.lineas) ? body.lineas : []
  const notasCliente = typeof body.notas_cliente === 'string' ? body.notas_cliente : null

  if (lineas.length === 0) {
    return NextResponse.json({ error: 'Add at least one product' }, { status: 400 })
  }

  for (const l of lineas) {
    if (!l.producto_id && !l.descripcion_libre?.trim()) {
      return NextResponse.json({ error: 'Each line needs a product or a description' }, { status: 400 })
    }
    if (!l.cantidad || Number(l.cantidad) <= 0) {
      return NextResponse.json({ error: 'Invalid quantity in one of the lines' }, { status: 400 })
    }
  }

  await adminClient.from('solicitud_lineas').delete().eq('solicitud_id', solicitud.id)

  const lineasInsert = lineas.map((l: { producto_id?: string; descripcion_libre?: string; cantidad: number; notas?: string }) => ({
    solicitud_id: solicitud.id,
    producto_id: l.producto_id || null,
    descripcion_libre: l.descripcion_libre || null,
    cantidad: Number(l.cantidad),
    notas: l.notas || null,
  }))
  await adminClient.from('solicitud_lineas').insert(lineasInsert)

  const { data: actualEstado } = await adminClient
    .from('solicitudes')
    .select('veces_devuelta')
    .eq('id', solicitud.id)
    .single()

  await adminClient
    .from('solicitudes')
    .update({
      estado: 'pendiente',
      notas_cliente: notasCliente,
      token_edicion: null,
      veces_devuelta: (actualEstado?.veces_devuelta || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', solicitud.id)

  await adminClient.from('solicitud_eventos').insert({
    solicitud_id: solicitud.id,
    tipo: 'reenviada',
    comentario: notasCliente,
  })

  const clienteNombre = (Array.isArray(solicitud.cliente) ? solicitud.cliente[0]?.nombre : (solicitud.cliente as { nombre?: string })?.nombre) || 'Cliente'

  const { data: operativos } = await adminClient
    .from('usuarios')
    .select('id')
    .in('rol', ['operaciones', 'admin'])
    .eq('activo', true)

  if (operativos && operativos.length > 0) {
    await adminClient.from('notificaciones').insert(
      operativos.map(u => ({
        usuario_id: u.id,
        tipo: 'solicitud_reenviada',
        mensaje: `${clienteNombre} respondió a la observación y reenvió su pedido`,
      }))
    )
  }

  return NextResponse.json({ ok: true, solicitud_id: solicitud.id }, { status: 200 })
}
