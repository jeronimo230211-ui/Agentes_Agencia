import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { generarPDFProforma } from '@/lib/pdf/generator'
import { enviarProformaCliente } from '@/lib/email'

// Ruta pública — el cliente aprueba o pide cambios sin login, vía el link
// que le mandó enviarProformaParaAprobacion(). Distinta de /api/aprobacion-token,
// que es el link interno de Marta antes de que la proforma se le envíe al cliente.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

  const adminClient = createAdminClient()

  const { data: tokenData } = await adminClient
    .from('tokens_aprobacion_cliente')
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
      lineas:proforma_lineas(*)
    `)
    .eq('id', tokenData.proforma_id)
    .order('orden', { referencedTable: 'proforma_lineas', ascending: true })
    .single()

  if (!proforma || proforma.estado !== 'enviada') {
    return NextResponse.json({ error: 'Proforma no disponible para revisión' }, { status: 400 })
  }

  return NextResponse.json({ proforma })
}

export async function POST(req: NextRequest) {
  const { token, accion, comentario } = await req.json()
  if (!token || !accion) return NextResponse.json({ error: 'Token y acción requeridos' }, { status: 400 })

  const adminClient = createAdminClient()

  const { data: tokenData } = await adminClient
    .from('tokens_aprobacion_cliente')
    .select('proforma_id, expira_at, usado')
    .eq('token', token)
    .single()

  if (!tokenData || tokenData.usado || new Date(tokenData.expira_at) < new Date()) {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
  }

  const proformaId = tokenData.proforma_id

  const { data: proforma } = await adminClient
    .from('proformas')
    .select(`*, cliente:clientes(*), lineas:proforma_lineas(*)`)
    .eq('id', proformaId)
    .single()

  if (!proforma || proforma.estado !== 'enviada') {
    return NextResponse.json({ error: 'Proforma no disponible' }, { status: 400 })
  }

  if (accion === 'aprobar') {
    const pdfBuffer = await generarPDFProforma(proforma)

    // Excepción de proceso (ver memoria de la reunión con Marta): Hardware & Lumber
    // no hace abono anticipado, así que no se genera link de pago para su invoice.
    let pagoToken: string | undefined
    if (proforma.cliente?.slug !== 'hl') {
      const { data: tokenPago } = await adminClient
        .from('tokens_pago')
        .insert({ proforma_id: proformaId })
        .select('token')
        .single()
      pagoToken = tokenPago?.token
    }

    await enviarProformaCliente(proforma, pdfBuffer, pagoToken, true)

    await adminClient.from('proformas').update({
      estado: 'facturada',
      updated_at: new Date().toISOString(),
    }).eq('id', proformaId)

    await adminClient.from('proforma_eventos').insert({
      proforma_id: proformaId,
      estado_desde: 'enviada',
      estado_hacia: 'facturada',
      comentario: 'Cliente aprobó la proforma — invoice enviado',
    })

    await adminClient.from('tokens_aprobacion_cliente').update({ usado: true }).eq('token', token)

    if (proforma.creada_por) {
      await adminClient.from('notificaciones').insert({
        usuario_id: proforma.creada_por,
        tipo: 'proforma_aprobada_cliente',
        proforma_id: proformaId,
        mensaje: `Proforma ${proforma.numero}: el cliente aprobó — invoice enviado`,
      })
    }

    return NextResponse.json({ ok: true, estado: 'facturada' })

  } else if (accion === 'rechazar') {
    if (!comentario?.trim()) return NextResponse.json({ error: 'Comentario requerido' }, { status: 400 })

    await adminClient.from('proformas').update({
      estado: 'cambios_solicitados',
      comentario_cliente: comentario,
      updated_at: new Date().toISOString(),
    }).eq('id', proformaId)

    await adminClient.from('proforma_eventos').insert({
      proforma_id: proformaId,
      estado_desde: 'enviada',
      estado_hacia: 'cambios_solicitados',
      comentario,
    })

    await adminClient.from('tokens_aprobacion_cliente').update({ usado: true }).eq('token', token)

    if (proforma.creada_por) {
      await adminClient.from('notificaciones').insert({
        usuario_id: proforma.creada_por,
        tipo: 'proforma_cambios_cliente',
        proforma_id: proformaId,
        mensaje: `Proforma ${proforma.numero}: el cliente pidió cambios — ${comentario}`,
      })
    }

    return NextResponse.json({ ok: true, estado: 'cambios_solicitados' })

  } else {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }
}
