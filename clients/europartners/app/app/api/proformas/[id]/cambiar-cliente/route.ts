import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

type Params = { params: { id: string } }

// Permite corregir el cliente de una proforma DESPUÉS de creada — caso real
// que lo motivó: la 3-0256 se creó con el cliente equivocado (pedido de
// Deisy, 2026-11-02). Solo tiene sentido mientras nada se le ha mostrado ni
// enviado al cliente todavía: 'borrador' (recién creada/editándose) o
// 'en_revision' (esperando aprobación interna de Marta, el cliente final
// jamás la vio). Deliberadamente MÁS restrictivo que ESTADOS_EDITABLES de
// ../route.ts (que incluye 'aprobada', porque esa sí ya pudo generar un PDF
// o cotizar con las condiciones del cliente original) — no reusar esa
// constante aquí.
const ESTADOS_PERMITE_CAMBIO_CLIENTE = ['borrador', 'en_revision']

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
      error: `No se puede cambiar el cliente de una proforma en estado '${proforma.estado}' — ya pudo haberse mostrado o cotizado al cliente original. Solo se permite en 'borrador' o 'en_revision'.`,
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

  const { error: updateError } = await supabase
    .from('proformas')
    .update({ cliente_id: nuevoClienteId, updated_at: new Date().toISOString() })
    .eq('id', params.id)

  if (updateError) {
    console.error('[POST /api/proformas/:id/cambiar-cliente] update falló', { proforma_id: params.id, error: updateError })
    return NextResponse.json({ error: `No se pudo cambiar el cliente: ${updateError.message}` }, { status: 500 })
  }

  // No hay cambio de estado (estado_desde === estado_hacia a propósito) —
  // proforma_eventos exige estado_hacia NOT NULL pero no exige que sea
  // distinto de estado_desde, así que este patrón sirve también para dejar
  // rastro de auditoría de cambios que no mueven el flujo. El nombre del
  // cliente anterior se guarda en el comentario porque una vez corre el
  // UPDATE de arriba ya no hay forma de recuperarlo desde la proforma.
  const clienteAnterior = Array.isArray(proforma.cliente) ? proforma.cliente[0] : proforma.cliente
  const nombreAnterior = (clienteAnterior as { nombre?: string } | null)?.nombre || '(desconocido)'
  await supabase.from('proforma_eventos').insert({
    proforma_id: params.id,
    usuario_id: session.user.id,
    estado_desde: proforma.estado,
    estado_hacia: proforma.estado,
    comentario: `Cliente cambiado de "${nombreAnterior}" a "${nuevoCliente.nombre}"`,
  })

  return NextResponse.json({ ok: true, cliente: nuevoCliente })
}
