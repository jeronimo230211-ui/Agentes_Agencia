import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { enviarNotificacionResultado } from '@/lib/email'
import { poblarHistorialPrecios } from '@/lib/historialPrecios'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Verificar que es admin (Marta)
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', session.user.id)
    .single()

  if (usuario?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo Marta puede aprobar proformas' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))

  const { data: proforma } = await supabase
    .from('proformas')
    .select(`*, lineas:proforma_lineas(*), cliente:clientes(*)`)
    .eq('id', params.id)
    .single()

  if (!proforma) return NextResponse.json({ error: 'Proforma no encontrada' }, { status: 404 })
  if (proforma.estado !== 'en_revision') {
    return NextResponse.json({ error: `Estado inválido: ${proforma.estado}` }, { status: 400 })
  }

  // Si Marta ajustó líneas, actualizar antes de aprobar
  if (body.lineas_ajustadas?.length) {
    const adminClient = createAdminClient()
    for (const linea of body.lineas_ajustadas) {
      await adminClient
        .from('proforma_lineas')
        .update({
          precio_cliente_usd: linea.precio_cliente_usd,
          margen_pct: linea.margen_pct,
          subtotal_cliente_usd: linea.precio_cliente_usd * linea.cantidad,
        })
        .eq('id', linea.id)
    }
  }

  // Aprobar
  await supabase
    .from('proformas')
    .update({
      estado: 'aprobada',
      aprobada_por: session.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  // Registrar evento
  await supabase.from('proforma_eventos').insert({
    proforma_id: params.id,
    usuario_id: session.user.id,
    estado_desde: 'en_revision',
    estado_hacia: 'aprobada',
    comentario: body.comentario || null,
  })

  // Poblar historial_precios (operación crítica — usar service key)
  const adminClient = createAdminClient()
  await poblarHistorialPrecios(adminClient, proforma)

  // Marcar tokens como usados
  await adminClient
    .from('tokens_aprobacion')
    .update({ usado: true })
    .eq('proforma_id', params.id)
    .eq('usado', false)

  // Notificar a Deisy (in-app + email)
  let email_enviado = false
  let email_error: string | undefined
  if (proforma.creada_por) {
    // adminClient (no `supabase`) — RLS "notif_own"/"usuarios_own" solo dejan ver/escribir la
    // propia fila, y aquí es Marta insertando/leyendo la fila de Deisy. Mismo bug ya corregido
    // en enviar-revision/route.ts.
    await adminClient.from('notificaciones').insert({
      usuario_id: proforma.creada_por,
      tipo: 'proforma_aprobada',
      proforma_id: params.id,
      mensaje: `Proforma ${proforma.numero} aprobada — ya puedes enviarla al cliente`,
    })

    const { data: creador } = await adminClient.from('usuarios').select('email').eq('id', proforma.creada_por).single()
    if (creador?.email) {
      try {
        await enviarNotificacionResultado(proforma, 'aprobada', creador.email)
        email_enviado = true
      } catch (e) {
        email_error = e instanceof Error ? e.message : String(e)
        console.error('Error enviando email de aprobación a Deisy:', email_error)
      }
    }
  }

  return NextResponse.json({ ok: true, estado: 'aprobada', email_enviado, email_error })
}
