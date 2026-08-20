import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { poblarHistorialPrecios } from '@/lib/historialPrecios'

type Params = { params: { id: string } }

// Aprobación directa sin pasar por Marta — solo para proformas marcadas
// requiere_revision = false (default para proformas nuevas). Deisy u otro
// usuario de operaciones puede aprobar y, de inmediato después, enviar al
// cliente (endpoint enviar-cliente, que ya solo exige estado = 'aprobada').
export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado para aprobar proformas' }, { status: 403 })
  }

  const { data: proforma, error: pfError } = await supabase
    .from('proformas')
    .select(`*, lineas:proforma_lineas(*)`)
    .eq('id', params.id)
    .single()

  if (pfError || !proforma) return NextResponse.json({ error: 'Proforma no encontrada' }, { status: 404 })
  if (!['borrador', 'rechazada', 'cambios_solicitados'].includes(proforma.estado)) {
    return NextResponse.json({ error: `Estado inválido: ${proforma.estado}` }, { status: 400 })
  }
  if (proforma.requiere_revision) {
    return NextResponse.json({ error: 'Esta proforma requiere revisión de Marta — envíala a revisión en vez de aprobarla directo' }, { status: 400 })
  }
  if (!proforma.lineas?.length) {
    return NextResponse.json({ error: 'La proforma no tiene líneas' }, { status: 400 })
  }

  const estadoDesde = proforma.estado

  const { error: updateError } = await supabase
    .from('proformas')
    .update({ estado: 'aprobada', aprobada_por: session.user.id, updated_at: new Date().toISOString() })
    .eq('id', params.id)

  if (updateError) {
    console.error('Error aprobando proforma directo:', updateError)
    return NextResponse.json({ error: 'Error al aprobar' }, { status: 500 })
  }

  await supabase.from('proforma_eventos').insert({
    proforma_id: params.id,
    usuario_id: session.user.id,
    estado_desde: estadoDesde,
    estado_hacia: 'aprobada',
    comentario: 'Auto-aprobada por operaciones (revisión no requerida)',
  })

  const adminClient = createAdminClient()
  await poblarHistorialPrecios(adminClient, proforma)

  return NextResponse.json({ ok: true, estado: 'aprobada' })
}
