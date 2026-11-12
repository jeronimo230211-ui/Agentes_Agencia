import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { esAccionDePrueba } from '@/lib/qaTest'

type Params = { params: { id: string } }

// Marca una proforma 'enviada' como 'facturada' SIN pasar por el link público
// del cliente (/aprobacion-cliente) -- para cuando el cliente aprobó y pagó
// por fuera del sistema (WhatsApp, correo, llamada) y nunca usó el link, caso
// que Jero confirmó es frecuente y dejaba proformas ya cobradas atascadas en
// "Pendiente de facturación" para siempre en /facturador. A propósito NO
// genera PDF ni envía correo -- eso ya pasa cuando el cliente sí usa el link
// (ver app/api/aprobacion-cliente/route.ts, acción 'aprobar'), y aquí la
// aprobación ya ocurrió fuera del sistema.
export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', session.user.id)
    .single()

  if (usuario?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo Marta puede marcar una proforma como facturada manualmente' }, { status: 403 })
  }

  const { data: proforma, error: pfError } = await supabase
    .from('proformas')
    .select('estado, creada_por, numero, notas_internas')
    .eq('id', params.id)
    .single()

  if (pfError || !proforma) return NextResponse.json({ error: 'Proforma no encontrada' }, { status: 404 })
  if (proforma.estado !== 'enviada') {
    return NextResponse.json({ error: `Solo se puede marcar como facturada una proforma enviada (estado actual: ${proforma.estado})` }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('proformas')
    .update({ estado: 'facturada', updated_at: new Date().toISOString() })
    .eq('id', params.id)

  if (updateError) {
    console.error('Error marcando proforma como facturada manualmente:', updateError)
    return NextResponse.json({ error: 'Error al actualizar el estado' }, { status: 500 })
  }

  // Comentario deliberadamente distinto al del flujo automático ('Cliente
  // aprobó la proforma — invoice enviado') para que el historial de eventos
  // deje claro que esta no pasó por el link público.
  await supabase.from('proforma_eventos').insert({
    proforma_id: params.id,
    usuario_id: session.user.id,
    estado_desde: 'enviada',
    estado_hacia: 'facturada',
    comentario: 'Facturada manualmente por el equipo (aprobación fuera del sistema)',
  })

  if (esAccionDePrueba(proforma.notas_internas)) {
    console.log(`[test] notificación de facturación manual omitida para proforma de prueba ${proforma.numero}`)
  } else if (proforma.creada_por) {
    const adminClient = createAdminClient()
    await adminClient.from('notificaciones').insert({
      usuario_id: proforma.creada_por,
      tipo: 'proforma_facturada_manual',
      proforma_id: params.id,
      mensaje: `Proforma ${proforma.numero}: marcada como facturada manualmente por el equipo`,
    })
  }

  return NextResponse.json({ ok: true, estado: 'facturada' })
}
