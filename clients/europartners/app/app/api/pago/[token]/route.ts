import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { formatUSD } from '@/lib/precio'

type Params = { params: { token: string } }

async function resolverToken(adminClient: ReturnType<typeof createAdminClient>, token: string) {
  const { data: tokenData } = await adminClient
    .from('tokens_pago')
    .select('proforma_id, expira_at')
    .eq('token', token)
    .single()

  if (!tokenData) return { error: 'Enlace no encontrado', status: 404 } as const
  if (new Date(tokenData.expira_at) < new Date()) return { error: 'Enlace expirado', status: 410 } as const

  return { proformaId: tokenData.proforma_id } as const
}

export async function GET(_req: NextRequest, { params }: Params) {
  const adminClient = createAdminClient()
  const resuelto = await resolverToken(adminClient, params.token)
  if ('error' in resuelto) return NextResponse.json({ error: resuelto.error }, { status: resuelto.status })

  const { data: proforma } = await adminClient
    .from('proformas')
    .select('id, numero, incoterm, total_fob_usd, total_cif_usd, estado_pago, comprobante_url, cliente:clientes(nombre)')
    .eq('id', resuelto.proformaId)
    .single()

  if (!proforma) return NextResponse.json({ error: 'Proforma no encontrada' }, { status: 404 })

  const total = proforma.total_cif_usd || proforma.total_fob_usd || 0

  return NextResponse.json({
    proforma: {
      numero: proforma.numero,
      cliente_nombre: (proforma.cliente as { nombre?: string } | null)?.nombre,
      total_formateado: formatUSD(total),
      estado_pago: proforma.estado_pago,
      comprobante_url: proforma.comprobante_url,
    },
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const adminClient = createAdminClient()
  const resuelto = await resolverToken(adminClient, params.token)
  if ('error' in resuelto) return NextResponse.json({ error: resuelto.error }, { status: resuelto.status })

  const formData = await req.formData()
  const archivo = formData.get('comprobante') as File | null
  const monto = formData.get('monto') as string | null

  if (!archivo) return NextResponse.json({ error: 'Sube el comprobante de pago' }, { status: 400 })
  if (archivo.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'El archivo no debe superar 10MB' }, { status: 400 })

  const ext = archivo.name.split('.').pop() || 'bin'
  const fileName = `comprobantes/${resuelto.proformaId}-${Date.now()}.${ext}`
  const buffer = Buffer.from(await archivo.arrayBuffer())

  const { error: uploadError } = await adminClient.storage
    .from('documentos')
    .upload(fileName, buffer, { contentType: archivo.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = adminClient.storage.from('documentos').getPublicUrl(fileName)

  const { data: proforma } = await adminClient
    .from('proformas')
    .update({
      comprobante_url: urlData.publicUrl,
      fecha_abono: new Date().toISOString().split('T')[0],
      monto_abono_recibido: monto ? Number(monto) : null,
      estado_pago: 'parcial',
      updated_at: new Date().toISOString(),
    })
    .eq('id', resuelto.proformaId)
    .select('numero, creada_por, cliente:clientes(nombre)')
    .single()

  if (proforma?.creada_por) {
    await adminClient.from('notificaciones').insert({
      usuario_id: proforma.creada_por,
      tipo: 'comprobante_subido',
      mensaje: `${(proforma.cliente as { nombre?: string } | null)?.nombre || 'Cliente'} subió el comprobante de pago de la proforma ${proforma.numero} — pendiente de validar`,
    })
  }

  return NextResponse.json({ ok: true })
}
