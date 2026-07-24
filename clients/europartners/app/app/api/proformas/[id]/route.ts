import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('proformas')
    .select(`
      *,
      cliente:clientes(*),
      parametros_precio:parametros_precio(*),
      creador:usuarios!creada_por(id, nombre),
      aprobador:usuarios!aprobada_por(id, nombre),
      lineas:proforma_lineas(
        *,
        producto:productos(id, codigo, descripcion, precio_fob_usd, precio_mayorista, precio_detallista),
        variante:producto_variantes(id, variante),
        componente:producto_componentes(id, componente)
      ),
      eventos:proforma_eventos(*, usuario:usuarios(nombre))
    `)
    .eq('id', params.id)
    .order('orden', { referencedTable: 'proforma_lineas', ascending: true })
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()

  // Solo se puede editar en estado borrador o rechazada
  const { data: current } = await supabase
    .from('proformas')
    .select('estado, cliente_id')
    .eq('id', params.id)
    .single()

  if (!current) return NextResponse.json({ error: 'Proforma no encontrada' }, { status: 404 })
  if (!['borrador', 'rechazada'].includes(current.estado)) {
    return NextResponse.json({ error: `No se puede editar una proforma en estado '${current.estado}'` }, { status: 400 })
  }

  const { lineas, ...proformaData } = body

  // Actualizar proforma
  const { data, error } = await supabase
    .from('proformas')
    .update({ ...proformaData, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Actualizar líneas si se enviaron
  if (lineas !== undefined) {
    await supabase.from('proforma_lineas').delete().eq('proforma_id', params.id)

    if (lineas.length > 0) {
      const lineasConId = lineas.map((l: Record<string, unknown>, i: number) => ({
        ...l,
        proforma_id: params.id,
        orden: i,
      }))
      await supabase.from('proforma_lineas').insert(lineasConId)
    }

    // Recalcular totales
    await recalcularTotales(supabase, params.id)
  }

  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: current } = await supabase
    .from('proformas')
    .select('estado')
    .eq('id', params.id)
    .single()

  if (current?.estado !== 'borrador') {
    return NextResponse.json({ error: 'Solo se pueden eliminar borradores' }, { status: 400 })
  }

  const { error } = await supabase.from('proformas').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

async function recalcularTotales(supabase: ReturnType<typeof createRouteHandlerClient>, proformaId: string) {
  const { data: lineas } = await supabase
    .from('proforma_lineas')
    .select('subtotal_cliente_usd')
    .eq('proforma_id', proformaId)

  const { data: proforma } = await supabase
    .from('proformas')
    .select('parametros_precio_id, incoterm')
    .eq('id', proformaId)
    .single()

  const totalFob = (lineas || []).reduce((sum: number, l: { subtotal_cliente_usd?: number }) => sum + (l.subtotal_cliente_usd || 0), 0)

  let totalFlete = 0
  if (proforma?.parametros_precio_id && proforma?.incoterm !== 'FOB') {
    const { data: params } = await supabase
      .from('parametros_precio')
      .select('flete_usd')
      .eq('id', proforma.parametros_precio_id)
      .single()
    totalFlete = params?.flete_usd || 0
  }

  await supabase
    .from('proformas')
    .update({
      total_fob_usd: totalFob,
      total_flete_usd: totalFlete,
      total_cif_usd: totalFob + totalFlete,
    })
    .eq('id', proformaId)
}
