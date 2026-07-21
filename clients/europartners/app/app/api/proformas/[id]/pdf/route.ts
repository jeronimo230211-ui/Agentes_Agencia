import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { generarPDFProforma } from '@/lib/pdf/generator'
import { cookies } from 'next/headers'

type Params = { params: { id: string } }

export async function GET(req: NextRequest, { params }: Params) {
  // Soporta acceso con token de aprobación (Marta) o sesión normal
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  const adminClient = createAdminClient()

  if (token) {
    // Validar token de aprobación
    const { data: tokenData } = await adminClient
      .from('tokens_aprobacion')
      .select('proforma_id, expira_at, usado')
      .eq('token', token)
      .single()

    if (!tokenData || tokenData.usado || new Date(tokenData.expira_at) < new Date()) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }

    if (tokenData.proforma_id !== params.id) {
      return NextResponse.json({ error: 'Token no corresponde a esta proforma' }, { status: 401 })
    }
  } else {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Cargar proforma completa
  const { data: proforma, error } = await adminClient
    .from('proformas')
    .select(`
      *,
      cliente:clientes(*),
      parametros_precio:parametros_precio(*),
      lineas:proforma_lineas(*)
    `)
    .eq('id', params.id)
    .order('orden', { referencedTable: 'proforma_lineas', ascending: true })
    .single()

  if (error || !proforma) {
    return NextResponse.json({ error: 'Proforma no encontrada' }, { status: 404 })
  }

  // Verificar si ya hay PDF cacheado en Storage
  if (proforma.pdf_url && proforma.estado === 'aprobada') {
    return NextResponse.redirect(proforma.pdf_url)
  }

  // Generar PDF
  const pdfBuffer = await generarPDFProforma(proforma)

  // Cachear en Supabase Storage si está aprobada
  if (proforma.estado === 'aprobada') {
    const fileName = `proformas-pdf/${proforma.id}.pdf`
    const { data: upload } = await adminClient.storage
      .from('documentos')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (upload) {
      const { data: urlData } = adminClient.storage
        .from('documentos')
        .getPublicUrl(fileName)

      await adminClient
        .from('proformas')
        .update({ pdf_url: urlData.publicUrl, pdf_generado_at: new Date().toISOString() })
        .eq('id', params.id)
    }
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Proforma-${proforma.numero}.pdf"`,
    },
  })
}
