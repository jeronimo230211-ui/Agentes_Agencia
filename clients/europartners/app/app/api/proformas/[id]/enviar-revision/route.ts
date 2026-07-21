import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { enviarNotificacionAprobacion } from '@/lib/email'

type Params = { params: { id: string } }

export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

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
  if (proforma.estado !== 'borrador' && proforma.estado !== 'rechazada') {
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

  // Crear token de aprobación
  const { data: tokenData } = await supabase
    .from('tokens_aprobacion')
    .insert({ proforma_id: params.id })
    .select('token')
    .single()

  // Buscar admin (Marta) una sola vez — sirve tanto para el email como la notificación in-app
  const { data: marta } = await supabase
    .from('usuarios')
    .select('id, email')
    .eq('rol', 'admin')
    .eq('activo', true)
    .limit(1)
    .single()

  let email_enviado = false
  let email_error: string | undefined
  if (tokenData?.token && marta?.email) {
    try {
      await enviarNotificacionAprobacion(proforma, tokenData.token, marta.email)
      email_enviado = true
    } catch (e) {
      email_error = e instanceof Error ? e.message : String(e)
      console.error('Error enviando email a Marta:', email_error)
      // No fallar el request si el email falla — se reporta en la respuesta
    }
  } else if (!marta?.email) {
    email_error = 'El usuario admin no tiene email configurado'
  }

  if (marta) {
    await supabase.from('notificaciones').insert({
      usuario_id: marta.id,
      tipo: 'proforma_para_revisar',
      proforma_id: params.id,
      mensaje: `Proforma ${proforma.numero} para ${proforma.cliente?.nombre} lista para revisión`,
    })
  }

  return NextResponse.json({ ok: true, estado: 'en_revision', email_enviado, email_error })
}
