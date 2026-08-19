import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { enviarNotificacionAprobacion } from '@/lib/email'

type Params = { params: { id: string } }

export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado para enviar proformas a revisión' }, { status: 403 })
  }

  // Cargar proforma completa
  const { data: proforma, error: pfError } = await supabase
    .from('proformas')
    .select(`
      *,
      cliente:clientes(*),
      parametros_precio:parametros_precio(*),
      lineas:proforma_lineas(*)
    `)
    .eq('id', params.id)
    .single()

  if (pfError || !proforma) return NextResponse.json({ error: 'Proforma no encontrada' }, { status: 404 })
  if (!['borrador', 'rechazada', 'cambios_solicitados'].includes(proforma.estado)) {
    return NextResponse.json({ error: `Estado inválido: ${proforma.estado}` }, { status: 400 })
  }
  if (!proforma.lineas?.length) {
    return NextResponse.json({ error: 'La proforma no tiene líneas' }, { status: 400 })
  }

  // Cambiar estado
  const { error: updateError } = await supabase
    .from('proformas')
    .update({ estado: 'en_revision' })
    .eq('id', params.id)

  if (updateError) {
    console.error('Error cambiando estado:', updateError)
    return NextResponse.json({ error: 'Error al cambiar estado' }, { status: 500 })
  }

  // Registrar evento
  await supabase.from('proforma_eventos').insert({
    proforma_id: params.id,
    usuario_id: session.user.id,
    estado_desde: proforma.estado,
    estado_hacia: 'en_revision',
    comentario: 'Enviada a revisión de Marta',
  })

  // Crear token de aprobación — tokens_aprobacion solo tiene policy RLS para
  // service_role, así que hay que usar el admin client (el cliente de sesión
  // normal fallaría en silencio con 42501 y el email nunca se intentaría).
  const adminClient = createAdminClient()
  const { data: tokenData, error: tokenError } = await adminClient
    .from('tokens_aprobacion')
    .insert({ proforma_id: params.id })
    .select('token')
    .single()

  // Buscar admin (Marta) una sola vez — sirve tanto para el email como la notificación in-app.
  // Usa adminClient (no `supabase`) por la misma razón que tokens_aprobacion arriba: la policy
  // RLS "usuarios_own" (id = auth.uid()) solo deja ver la propia fila, así que con el cliente de
  // sesión de Deisy esta consulta siempre volvía vacía y el correo nunca se intentaba.
  const { data: marta } = await adminClient
    .from('usuarios')
    .select('id, email')
    .eq('rol', 'admin')
    .eq('activo', true)
    .limit(1)
    .single()

  let email_enviado = false
  let email_error: string | undefined
  if (tokenError || !tokenData?.token) {
    email_error = tokenError ? `Error creando token de aprobación: ${tokenError.message}` : 'No se pudo generar el token de aprobación'
    console.error(email_error)
  } else if (!marta?.email) {
    email_error = 'El usuario admin no tiene email configurado'
  } else {
    try {
      await enviarNotificacionAprobacion(proforma, tokenData.token, marta.email, proforma.comentario_cliente || undefined)
      email_enviado = true
    } catch (e) {
      email_error = e instanceof Error ? e.message : String(e)
      console.error('Error enviando email a Marta:', email_error)
      // No fallar el request si el email falla — se reporta en la respuesta
    }
  }

  if (marta) {
    // Mismo motivo que arriba: notificaciones tiene policy RLS "notif_own" (usuario_id =
    // auth.uid()), así que con el cliente de sesión de Deisy este insert para Marta también
    // fallaba en silencio.
    await adminClient.from('notificaciones').insert({
      usuario_id: marta.id,
      tipo: 'proforma_para_revisar',
      proforma_id: params.id,
      mensaje: `Proforma ${proforma.numero} para ${proforma.cliente?.nombre} lista para revisión`,
    })
  }

  return NextResponse.json({ ok: true, estado: 'en_revision', email_enviado, email_error })
}
