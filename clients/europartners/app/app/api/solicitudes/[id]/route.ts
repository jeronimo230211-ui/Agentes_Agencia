import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { enviarSolicitudDevuelta } from '@/lib/email'

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

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado para actualizar solicitudes' }, { status: 403 })
  }

  const { estado, comentario } = await req.json()
  if (!['revisada', 'descartada', 'devuelta'].includes(estado)) {
    return NextResponse.json({ error: 'Estado no permitido' }, { status: 400 })
  }
  if (estado === 'devuelta' && !comentario?.trim()) {
    return NextResponse.json({ error: 'Escribe una observación para el cliente' }, { status: 400 })
  }

  const { data: current } = await supabase
    .from('solicitudes')
    .select('estado, cliente:clientes(nombre, contacto_email)')
    .eq('id', params.id)
    .single()

  if (!current || current.estado === 'convertida') {
    return NextResponse.json({ error: 'La solicitud ya fue convertida en proforma' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const updatePayload: Record<string, unknown> = {
    estado,
    revisada_por: session.user.id,
    updated_at: new Date().toISOString(),
  }

  let tokenEdicion: string | null = null
  if (estado === 'devuelta') {
    tokenEdicion = randomBytes(16).toString('hex')
    updatePayload.motivo_devolucion = comentario.trim()
    updatePayload.token_edicion = tokenEdicion
  }

  // RLS de `solicitudes` solo permite update a service_role.
  const { data, error } = await adminClient
    .from('solicitudes')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let email_enviado = false
  let email_error: string | undefined

  if (estado === 'devuelta' && tokenEdicion) {
    await adminClient.from('solicitud_eventos').insert({
      solicitud_id: params.id,
      usuario_id: session.user.id,
      tipo: 'devuelta',
      comentario: comentario.trim(),
    })

    const clienteJoin = current.cliente as { nombre?: string; contacto_email?: string } | { nombre?: string; contacto_email?: string }[] | null
    const cliente = Array.isArray(clienteJoin) ? clienteJoin[0] : clienteJoin

    if (cliente?.contacto_email) {
      try {
        await enviarSolicitudDevuelta(cliente.contacto_email, cliente.nombre || 'Cliente', comentario.trim(), tokenEdicion)
        email_enviado = true
      } catch (e) {
        email_error = e instanceof Error ? e.message : String(e)
        console.error('Error enviando email de devolución al cliente:', email_error)
      }
    }
  }

  return NextResponse.json({ data, email_enviado, email_error })
}
