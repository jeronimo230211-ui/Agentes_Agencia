import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { calcMargen } from '@/lib/precio'

type Params = { params: { id: string } }

// Convierte una solicitud del cliente en una proforma borrador, pre-llenando
// las líneas con el precio mayorista/detallista del cliente (sigue siendo
// editable a mano en el cotizador para casos particulares).
export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: solicitud } = await supabase
    .from('solicitudes')
    .select(`
      *,
      cliente:clientes(id, incoterm, modo_pricing, tipo),
      lineas:solicitud_lineas(*, producto:productos(id, codigo, nombre, precio_fob_usd, precio_mayorista, precio_detallista))
    `)
    .eq('id', params.id)
    .single()

  if (!solicitud) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  if (solicitud.estado === 'convertida') {
    return NextResponse.json({ error: 'Esta solicitud ya fue convertida en proforma' }, { status: 400 })
  }

  const { data: proforma, error: proformaError } = await supabase
    .from('proformas')
    .insert({
      cliente_id: solicitud.cliente_id,
      creada_por: session.user.id,
      incoterm: solicitud.cliente?.incoterm || 'FOB',
      modo_pricing: solicitud.cliente?.modo_pricing || 'set',
      tipo_precio: solicitud.cliente?.tipo || 'mayorista',
      estado: 'borrador',
      fecha: new Date().toISOString().split('T')[0],
      fecha_vencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notas_internas: solicitud.notas_cliente ? `Solicitud del cliente: ${solicitud.notas_cliente}` : null,
    })
    .select()
    .single()

  if (proformaError) return NextResponse.json({ error: proformaError.message }, { status: 500 })

  type SolicitudLineaConProducto = {
    producto_id?: string
    descripcion_libre?: string
    cantidad: number
    producto?: {
      codigo?: string
      nombre?: string
      precio_fob_usd?: number
      precio_mayorista?: number
      precio_detallista?: number
    }
  }

  const tipoPrecio = solicitud.cliente?.tipo || 'mayorista'

  const lineasInsert = (solicitud.lineas || []).map((l: SolicitudLineaConProducto, i: number) => {
    const precioCosto = l.producto?.precio_fob_usd ?? null
    const precioCliente = tipoPrecio === 'mayorista'
      ? l.producto?.precio_mayorista
      : l.producto?.precio_detallista

    return {
      proforma_id: proforma.id,
      orden: i,
      producto_id: l.producto_id || null,
      descripcion_pdf: l.producto?.nombre || l.descripcion_libre || 'Producto sin especificar',
      codigo_pdf: l.producto?.codigo || null,
      cantidad: l.cantidad,
      precio_costo_usd: precioCosto,
      precio_cliente_usd: precioCliente ?? null,
      margen_pct: (precioCosto && precioCliente) ? calcMargen(precioCosto, precioCliente) : null,
    }
  })

  if (lineasInsert.length > 0) {
    await supabase.from('proforma_lineas').insert(lineasInsert)
  }

  await supabase
    .from('solicitudes')
    .update({
      estado: 'convertida',
      proforma_id: proforma.id,
      revisada_por: session.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  return NextResponse.json({ data: proforma }, { status: 201 })
}
