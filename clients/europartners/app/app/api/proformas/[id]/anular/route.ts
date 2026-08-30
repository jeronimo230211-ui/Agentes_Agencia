import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { enviarNotificacionResultado } from '@/lib/email'

type Params = { params: { id: string } }

// Anula una factura ya emitida (estado 'facturada') — para cuando Deisy o
// Marta encuentran un error después de que el cliente ya aprobó. Mismo
// patrón que rechazar/route.ts (motivo obligatorio, evento, notificación).
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
    return NextResponse.json({ error: 'Solo Marta puede anular una factura' }, { status: 403 })
  }

  const { motivo } = await req.json()
  if (!motivo?.trim()) {
    return NextResponse.json({ error: 'El motivo de anulación es requerido' }, { status: 400 })
  }

  const { data: proforma } = await supabase
    .from('proformas')
    .select('estado, creada_por, numero, incoterm, total_fob_usd, total_cif_usd, cliente:clientes(nombre)')
    .eq('id', params.id)
    .single()

  if (!proforma) return NextResponse.json({ error: 'Proforma no encontrada' }, { status: 404 })
  if (proforma.estado !== 'facturada') {
    return NextResponse.json({ error: `Solo se puede anular una factura ya emitida (estado actual: ${proforma.estado})` }, { status: 400 })
  }

  await supabase
    .from('proformas')
    .update({
      estado: 'anulada',
      motivo_anulacion: motivo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  await supabase.from('proforma_eventos').insert({
    proforma_id: params.id,
    usuario_id: session.user.id,
    estado_desde: 'facturada',
    estado_hacia: 'anulada',
    comentario: motivo,
  })

  // Notificar a Deisy (in-app + email)
  let email_enviado = false
  let email_error: string | undefined
  if (proforma.creada_por) {
    const adminClient = createAdminClient()
    await adminClient.from('notificaciones').insert({
      usuario_id: proforma.creada_por,
      tipo: 'proforma_anulada',
      proforma_id: params.id,
      mensaje: `Factura ${proforma.numero} anulada: ${motivo}`,
    })

    const { data: creador } = await adminClient.from('usuarios').select('email').eq('id', proforma.creada_por).single()
    if (creador?.email) {
      try {
        await enviarNotificacionResultado(proforma, 'anulada', creador.email, motivo)
        email_enviado = true
      } catch (e) {
        email_error = e instanceof Error ? e.message : String(e)
        console.error('Error enviando email de anulación a Deisy:', email_error)
      }
    }
  }

  return NextResponse.json({ ok: true, estado: 'anulada', email_enviado, email_error })
}
