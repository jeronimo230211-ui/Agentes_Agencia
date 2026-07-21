import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { enviarNotificacionResultado } from '@/lib/email'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', session.user.id)
    .single()

  if (usuario?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo Marta puede rechazar proformas' }, { status: 403 })
  }

  const { motivo } = await req.json()
  if (!motivo?.trim()) {
    return NextResponse.json({ error: 'El motivo de rechazo es requerido' }, { status: 400 })
  }

  const { data: proforma } = await supabase
    .from('proformas')
    .select('estado, creada_por, numero, incoterm, total_fob_usd, total_cif_usd, cliente:clientes(nombre)')
    .eq('id', params.id)
    .single()

  if (!proforma) return NextResponse.json({ error: 'Proforma no encontrada' }, { status: 404 })
  if (proforma.estado !== 'en_revision') {
    return NextResponse.json({ error: `Estado inválido: ${proforma.estado}` }, { status: 400 })
  }

  await supabase
    .from('proformas')
    .update({
      estado: 'rechazada',
      motivo_rechazo: motivo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  await supabase.from('proforma_eventos').insert({
    proforma_id: params.id,
    usuario_id: session.user.id,
    estado_desde: 'en_revision',
    estado_hacia: 'rechazada',
    comentario: motivo,
  })

  // Notificar a Deisy (in-app + email)
  let email_enviado = false
  let email_error: string | undefined
  if (proforma.creada_por) {
    await supabase.from('notificaciones').insert({
      usuario_id: proforma.creada_por,
      tipo: 'proforma_rechazada',
      proforma_id: params.id,
      mensaje: `Proforma ${proforma.numero} rechazada: ${motivo}`,
    })

    const { data: creador } = await supabase.from('usuarios').select('email').eq('id', proforma.creada_por).single()
    if (creador?.email) {
      try {
        await enviarNotificacionResultado(proforma, 'rechazada', creador.email, motivo)
        email_enviado = true
      } catch (e) {
        email_error = e instanceof Error ? e.message : String(e)
        console.error('Error enviando email de rechazo a Deisy:', email_error)
      }
    }
  }

  return NextResponse.json({ ok: true, estado: 'rechazada', email_enviado, email_error })
}
