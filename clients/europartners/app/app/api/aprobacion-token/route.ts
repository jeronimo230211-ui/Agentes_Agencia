import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { poblarHistorialPrecios } from '@/lib/historialPrecios'

// Ruta pública para validar token y aprobar/rechazar sin login
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

  const adminClient = createAdminClient()

  const { data: tokenData } = await adminClient
    .from('tokens_aprobacion')
    .select('proforma_id, expira_at, usado')
    .eq('token', token)
    .single()

  if (!tokenData) return NextResponse.json({ error: 'Token no encontrado' }, { status: 404 })
  if (tokenData.usado) return NextResponse.json({ error: 'Token ya utilizado' }, { status: 410 })
  if (new Date(tokenData.expira_at) < new Date()) return NextResponse.json({ error: 'Token expirado' }, { status: 410 })

  const { data: proforma } = await adminClient
    .from('proformas')
    .select(`
      *,
      cliente:clientes(*),
      parametros_precio:parametros_precio(*),
      lineas:proforma_lineas(*)
    `)
    .eq('id', tokenData.proforma_id)
    .order('orden', { referencedTable: 'proforma_lineas', ascending: true })
    .single()

  if (!proforma || proforma.estado !== 'en_revision') {
    return NextResponse.json({ error: 'Proforma no disponible para revisión' }, { status: 400 })
  }

  return NextResponse.json({ proforma })
}

export async function POST(req: NextRequest) {
  const { token, accion, motivo } = await req.json()
  if (!token || !accion) return NextResponse.json({ error: 'Token y acción requeridos' }, { status: 400 })

  const adminClient = createAdminClient()

  const { data: tokenData } = await adminClient
    .from('tokens_aprobacion')
    .select('proforma_id, expira_at, usado')
    .eq('token', token)
    .single()

  if (!tokenData || tokenData.usado || new Date(tokenData.expira_at) < new Date()) {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
  }

  const proformaId = tokenData.proforma_id

  if (accion === 'aprobar') {
    const { data: proforma } = await adminClient
      .from('proformas')
      .select(`*, lineas:proforma_lineas(*)`)
      .eq('id', proformaId)
      .single()

    if (!proforma || proforma.estado !== 'en_revision') {
      return NextResponse.json({ error: 'Proforma no disponible' }, { status: 400 })
    }

    await adminClient.from('proformas').update({
      estado: 'aprobada',
      updated_at: new Date().toISOString(),
    }).eq('id', proformaId)

    await adminClient.from('proforma_eventos').insert({
      proforma_id: proformaId,
      estado_desde: 'en_revision',
      estado_hacia: 'aprobada',
      comentario: 'Aprobada via enlace de email',
    })

    // Poblar historial
    await poblarHistorialPrecios(adminClient, proforma)

    // Marcar token como usado
    await adminClient.from('tokens_aprobacion').update({ usado: true }).eq('token', token)

    // Notificar a Deisy
    if (proforma.creada_por) {
      await adminClient.from('notificaciones').insert({
        usuario_id: proforma.creada_por,
        tipo: 'proforma_aprobada',
        proforma_id: proformaId,
        mensaje: `Proforma ${proforma.numero} aprobada — ya puedes enviarla al cliente`,
      })
    }

    return NextResponse.json({ ok: true, estado: 'aprobada' })

  } else if (accion === 'rechazar') {
    if (!motivo?.trim()) return NextResponse.json({ error: 'Motivo requerido' }, { status: 400 })

    const { data: proforma } = await adminClient
      .from('proformas')
      .select('estado, creada_por, numero')
      .eq('id', proformaId)
      .single()

    if (!proforma || proforma.estado !== 'en_revision') {
      return NextResponse.json({ error: 'Proforma no disponible' }, { status: 400 })
    }

    await adminClient.from('proformas').update({
      estado: 'rechazada',
      motivo_rechazo: motivo,
      updated_at: new Date().toISOString(),
    }).eq('id', proformaId)

    await adminClient.from('proforma_eventos').insert({
      proforma_id: proformaId,
      estado_desde: 'en_revision',
      estado_hacia: 'rechazada',
      comentario: motivo,
    })

    await adminClient.from('tokens_aprobacion').update({ usado: true }).eq('token', token)

    if (proforma.creada_por) {
      await adminClient.from('notificaciones').insert({
        usuario_id: proforma.creada_por,
        tipo: 'proforma_rechazada',
        proforma_id: proformaId,
        mensaje: `Proforma ${proforma.numero} rechazada: ${motivo}`,
      })
    }

    return NextResponse.json({ ok: true, estado: 'rechazada' })

  } else {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }
}
