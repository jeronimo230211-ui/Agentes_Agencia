import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

type Params = { params: { id: string } }

// Permite corregir el cliente de una proforma DESPUÉS de creada — caso real
// que lo motivó: la 3-0256 se creó con el cliente equivocado (pedido de
// Deisy, 2026-11-02). 'borrador' y 'en_revision' no cambian de estado (nada
// se le mostró aún al cliente final). 'aprobada' también se permite (pedido
// de Jero, 2026-11-02) porque en la práctica a veces el error de cliente se
// nota después de la aprobación de Marta -- pero como esa aprobación fue
// para las condiciones del cliente ORIGINAL, cambiar el cliente fuerza la
// proforma de vuelta a 'en_revision' para que Marta la apruebe de nuevo (ver
// más abajo).
const ESTADOS_PERMITE_CAMBIO_CLIENTE = ['borrador', 'en_revision', 'aprobada']

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado para cambiar el cliente de una proforma' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const nuevoClienteId = body?.cliente_id
  if (!nuevoClienteId || typeof nuevoClienteId !== 'string') {
    return NextResponse.json({ error: 'Falta cliente_id' }, { status: 400 })
  }

  const { data: proforma, error: pfError } = await supabase
    .from('proformas')
    .select('estado, cliente_id, numero, cliente:clientes(nombre)')
    .eq('id', params.id)
    .single()

  if (pfError || !proforma) return NextResponse.json({ error: 'Proforma no encontrada' }, { status: 404 })

  if (!ESTADOS_PERMITE_CAMBIO_CLIENTE.includes(proforma.estado)) {
    return NextResponse.json({
      error: `No se puede cambiar el cliente de una proforma en estado '${proforma.estado}' — ya pudo haberse mostrado o cotizado al cliente original. Solo se permite en 'borrador', 'en_revision' o 'aprobada'.`,
    }, { status: 400 })
  }

  if (nuevoClienteId === proforma.cliente_id) {
    return NextResponse.json({ error: 'Ese ya es el cliente actual de la proforma' }, { status: 400 })
  }

  const { data: nuevoCliente, error: clienteError } = await supabase
    .from('clientes')
    .select('id, nombre')
    .eq('id', nuevoClienteId)
    .single()

  if (clienteError || !nuevoCliente) {
    return NextResponse.json({ error: 'El cliente seleccionado no existe' }, { status: 400 })
  }

  const estadoOrigen = proforma.estado
  // Si venía aprobada, la aprobación de Marta fue para el cliente original
  // -- cambiar el cliente invalida esa aprobación y la devuelve a revisión.
  // En cualquier otro estado permitido (borrador/en_revision) no hay cambio
  // de estado, igual que antes.
  const estadoDestino = estadoOrigen === 'aprobada' ? 'en_revision' : estadoOrigen

  const { error: updateError } = await supabase
    .from('proformas')
    .update({
      cliente_id: nuevoClienteId,
      estado: estadoDestino,
      // aprobada_por ya no aplica una vez se revierte la aprobación -- se
      // vuelve a fijar cuando Marta la apruebe de nuevo.
      ...(estadoOrigen === 'aprobada' ? { aprobada_por: null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  if (updateError) {
    console.error('[POST /api/proformas/:id/cambiar-cliente] update falló', { proforma_id: params.id, error: updateError })
    return NextResponse.json({ error: `No se pudo cambiar el cliente: ${updateError.message}` }, { status: 500 })
  }

  // Cuando no hubo cambio de estado (estado_desde === estado_hacia a
  // propósito), este evento sirve solo como rastro de auditoría -- igual que
  // antes. Cuando sí lo hubo (aprobada -> en_revision), el evento refleja el
  // cambio real. El nombre del cliente anterior se guarda en el comentario
  // porque una vez corre el UPDATE de arriba ya no hay forma de recuperarlo
  // desde la proforma.
  const clienteAnterior = Array.isArray(proforma.cliente) ? proforma.cliente[0] : proforma.cliente
  const nombreAnterior = (clienteAnterior as { nombre?: string } | null)?.nombre || '(desconocido)'
  const comentario = estadoDestino !== estadoOrigen
    ? `Cliente cambiado de "${nombreAnterior}" a "${nuevoCliente.nombre}" — proforma devuelta a revisión (requiere nueva aprobación de Marta)`
    : `Cliente cambiado de "${nombreAnterior}" a "${nuevoCliente.nombre}"`

  await supabase.from('proforma_eventos').insert({
    proforma_id: params.id,
    usuario_id: session.user.id,
    estado_desde: estadoOrigen,
    estado_hacia: estadoDestino,
    comentario,
  })

  return NextResponse.json({ ok: true, cliente: nuevoCliente, estado: estadoDestino })
}
