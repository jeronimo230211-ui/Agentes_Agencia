import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { generarPDFProforma } from '@/lib/pdf/generator'
import { enviarProformaParaAprobacion } from '@/lib/email'
import { cookies } from 'next/headers'

type Params = { params: { id: string } }

export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado para enviar proformas al cliente' }, { status: 403 })
  }

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

  // El cliente debe aprobar la proforma antes de que se facture y se le pida el
  // pago — ver migración 009. El link de pago ya no se manda aquí, se genera
  // cuando el cliente aprueba (POST /api/aprobacion-cliente).
  const { data: tokenAprobacion } = await adminClient
    .from('tokens_aprobacion_cliente')
    .insert({ proforma_id: params.id })
    .select('token')
    .single()

  if (!tokenAprobacion) {
    return NextResponse.json({ error: 'No se pudo generar el link de aprobación' }, { status: 500 })
  }

  await enviarProformaParaAprobacion(proforma, pdfBuffer, tokenAprobacion.token)

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
