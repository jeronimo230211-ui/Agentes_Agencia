import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { generarPDFProforma } from '@/lib/pdf/generator'
import { enviarProformaCliente } from '@/lib/email'
import { cookies } from 'next/headers'

type Params = { params: { id: string } }

export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const adminClient = createAdminClient()

  const { data: proforma } = await adminClient
    .from('proformas')
    .select(`*, cliente:clientes(*), parametros_precio:parametros_precio(*), lineas:proforma_lineas(*)`)
    .eq('id', params.id)
    .order('orden', { referencedTable: 'proforma_lineas', ascending: true })
    .single()

  if (!proforma) return NextResponse.json({ error: 'Proforma no encontrada' }, { status: 404 })
  if (proforma.estado !== 'aprobada') {
    return NextResponse.json({ error: 'Solo se pueden enviar proformas aprobadas' }, { status: 400 })
  }
  if (!proforma.cliente?.contacto_email) {
    return NextResponse.json({ error: 'El cliente no tiene email registrado' }, { status: 400 })
  }

  const pdfBuffer = await generarPDFProforma(proforma)

  // Excepción de proceso (ver memoria de la reunión con Marta): Hardware & Lumber
  // no hace abono anticipado, así que no se genera link de pago para su proforma.
  let pagoToken: string | undefined
  if (proforma.cliente?.slug !== 'hl') {
    const { data: tokenPago } = await adminClient
      .from('tokens_pago')
      .insert({ proforma_id: params.id })
      .select('token')
      .single()
    pagoToken = tokenPago?.token
  }

  await enviarProformaCliente(proforma, pdfBuffer, pagoToken)

  // El % de abono requerido lo define Deisy/Marta caso a caso (no hay una
  // regla fija documentada) — se registra desde /despachos antes de crear
  // el despacho, no se calcula automáticamente aquí.
  await adminClient
    .from('proformas')
    .update({
      estado: 'enviada',
      fecha_envio_cliente: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  await supabase.from('proforma_eventos').insert({
    proforma_id: params.id,
    usuario_id: session.user.id,
    estado_desde: 'aprobada',
    estado_hacia: 'enviada',
    comentario: `PDF enviado a ${proforma.cliente.contacto_email}`,
  })

  return NextResponse.json({ ok: true, estado: 'enviada' })
}
