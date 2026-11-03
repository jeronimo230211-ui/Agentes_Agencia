import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

type Params = { params: { id: string } }

// Reactiva una proforma anulada por error (o cuyo motivo de anulación ya no
// aplica) para reutilizar su número en vez de crear una proforma nueva --
// pedido de Jero, 2026-11-02. Vuelve a 'borrador': desde ahí ya existen los
// flujos normales (cambiar cliente, editar líneas, enviar a revisión/aprobar)
// sin necesidad de duplicar esa lógica acá. El evento de anulación original
// NO se toca -- es historial; este endpoint solo agrega el evento de
// corrección, mismo patrón que ya usamos para el revertir de 3-0245.
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: proforma } = await supabase
    .from('proformas')
    .select('estado, creada_por, numero')
    .eq('id', params.id)
    .single()

  if (!proforma) return NextResponse.json({ error: 'Proforma no encontrada' }, { status: 404 })
  if (proforma.estado !== 'anulada') {
    return NextResponse.json({ error: `Solo se puede reactivar una proforma anulada (estado actual: '${proforma.estado}')` }, { status: 400 })
  }

  const { comentario } = await req.json().catch(() => ({}))
  if (!comentario?.trim()) {
    return NextResponse.json({ error: 'El motivo de la reactivación es requerido' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('proformas')
    .update({
      estado: 'borrador',
      motivo_anulacion: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  if (updateError) {
    console.error('[POST /api/proformas/:id/desanular] update falló', { proforma_id: params.id, error: updateError })
    return NextResponse.json({ error: `No se pudo reactivar: ${updateError.message}` }, { status: 500 })
  }

  await supabase.from('proforma_eventos').insert({
    proforma_id: params.id,
    usuario_id: session.user.id,
    estado_desde: 'anulada',
    estado_hacia: 'borrador',
    comentario,
  })

  // Notificar a quien la creó (in-app, sin email -- es una acción interna).
  if (proforma.creada_por) {
    const adminClient = createAdminClient()
    await adminClient.from('notificaciones').insert({
      usuario_id: proforma.creada_por,
      tipo: 'proforma_desanulada',
      proforma_id: params.id,
      mensaje: `Proforma ${proforma.numero} reactivada: ${comentario}`,
    })
  }

  return NextResponse.json({ ok: true, estado: 'borrador' })
}
