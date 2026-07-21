import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const estado = searchParams.get('estado')

  let query = supabase
    .from('despachos')
    .select(`
      *,
      proforma:proformas(id, numero, total_fob_usd, total_cif_usd, incoterm, estado, estado_pago, cliente:clientes(id, nombre))
    `)
    .order('created_at', { ascending: false })

  if (estado) query = query.eq('estado', estado)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

// Crea un despacho a partir de una proforma ya enviada — evita la doble
// digitación: cliente/producto/totales quedan ligados por proforma_id, no
// se vuelven a re-teclear.
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { proforma_id } = await req.json()
  if (!proforma_id) return NextResponse.json({ error: 'proforma_id requerido' }, { status: 400 })

  const { data: proforma } = await supabase
    .from('proformas')
    .select('id, estado, estado_pago, cliente:clientes(slug)')
    .eq('id', proforma_id)
    .single()

  if (!proforma) return NextResponse.json({ error: 'Proforma no encontrada' }, { status: 404 })
  if (!['enviada', 'facturada'].includes(proforma.estado)) {
    return NextResponse.json({ error: 'Solo se puede despachar una proforma ya enviada al cliente' }, { status: 400 })
  }

  // Hardware & Lumber (slug 'hl') no hace abono anticipado — ver proceso de Marta.
  const esHL = (proforma.cliente as { slug?: string } | null)?.slug === 'hl'
  if (!esHL && proforma.estado_pago !== 'pagado') {
    return NextResponse.json({ error: 'El pago debe estar confirmado antes de iniciar el despacho' }, { status: 400 })
  }

  const { data: existente } = await supabase
    .from('despachos')
    .select('id')
    .eq('proforma_id', proforma_id)
    .maybeSingle()

  if (existente) return NextResponse.json({ error: 'Esta proforma ya tiene un despacho creado' }, { status: 400 })

  const { data, error } = await supabase
    .from('despachos')
    .insert({ proforma_id, estado: 'preparando' })
    .select(`*, proforma:proformas(id, numero, cliente:clientes(nombre))`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
