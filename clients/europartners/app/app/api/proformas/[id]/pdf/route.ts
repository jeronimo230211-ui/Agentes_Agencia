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
      lineas:proforma_lineas(*, producto:productos(imagen_url))
    `)
    .eq('id', params.id)
    .order('orden', { referencedTable: 'proforma_lineas', ascending: true })
    .single()

  if (error || !proforma) {
    return NextResponse.json({ error: 'Proforma no encontrada' }, { status: 404 })
  }

  // Siempre se genera en el momento — este endpoint ANTES cacheaba el PDF
  // en Storage la primera vez que se veía una proforma 'aprobada' y servía
  // esa copia para siempre. Pensado para un estado que entonces era
  // inmodificable, dejó de tener sentido el 2026-09-24 al permitir editar
  // proformas ya aprobadas: cada cambio de plantilla o cada edición de
  // Deisy quedaba invisible hasta que algo disparara una invalidación
  // manual (varios bugs reales en producción por esto, 2026-10-05/06/13).
  // react-pdf tarda un par de segundos, el tráfico de este botón es bajo
  // — no vale la pena la complejidad de mantener la caché sincronizada.
  const pdfBuffer = await generarPDFProforma(proforma)

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Proforma-${proforma.numero}.pdf"`,
    },
  })
}
