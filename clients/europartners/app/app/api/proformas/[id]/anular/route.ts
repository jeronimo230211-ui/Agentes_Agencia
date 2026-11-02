import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { enviarNotificacionResultado } from '@/lib/email'

type Params = { params: { id: string } }

// Anula una proforma desde cualquier estado -- antes solo se podía anular una
// factura ya emitida ('facturada'). Deisy y Jero pidieron poder anular desde
// /proformas sin pasar por Facturador (ej. un borrador que ya no aplica, una
// proforma rechazada que no se va a retomar). Mismo patrón que
// rechazar/route.ts (motivo obligatorio, evento, notificación), pero el
// permiso varía según el estado de origen:
//   - 'facturada' -> solo admin (cancelar una factura ya emitida es más
//     delicado, es la regla de negocio real).
//   - cualquier otro estado no terminal -> operaciones o admin (Deisy es
//     operaciones y necesita poder anular ella misma).
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('rol, nombre')
    .eq('id', session.user.id)
    .single()

  const { data: proforma } = await supabase
    .from('proformas')
    .select('estado, creada_por, numero, incoterm, total_fob_usd, total_cif_usd, cliente:clientes(nombre)')
    .eq('id', params.id)
    .single()

  if (!proforma) return NextResponse.json({ error: 'Proforma no encontrada' }, { status: 404 })

  if (proforma.estado === 'anulada') {
    return NextResponse.json({ error: 'Esta proforma ya está anulada' }, { status: 400 })
  }

  // El chequeo de permiso depende del estado de origen -- ver comentario de
  // arriba. Se valida el estado antes del rol para que el mensaje de error
  // sea el mismo sin importar quién lo intente.
  if (proforma.estado === 'facturada') {
    if (usuario?.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo Marta puede anular una factura' }, { status: 403 })
    }
  } else if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { motivo } = await req.json()
  if (!motivo?.trim()) {
    return NextResponse.json({ error: 'El motivo de anulación es requerido' }, { status: 400 })
  }

  const estadoOrigen = proforma.estado

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
    estado_desde: estadoOrigen,
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
      mensaje: `Proforma ${proforma.numero} anulada: ${motivo}`,
    })

    const { data: creador } = await adminClient.from('usuarios').select('email').eq('id', proforma.creada_por).single()
    if (creador?.email) {
      try {
        await enviarNotificacionResultado(proforma, 'anulada', creador.email, motivo, usuario?.nombre)
        email_enviado = true
      } catch (e) {
        email_error = e instanceof Error ? e.message : String(e)
        console.error('Error enviando email de anulación a Deisy:', email_error)
      }
    }
  }

  return NextResponse.json({ ok: true, estado: 'anulada', email_enviado, email_error })
}
