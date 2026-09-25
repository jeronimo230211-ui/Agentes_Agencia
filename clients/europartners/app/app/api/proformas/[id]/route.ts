import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

type Params = { params: { id: string } }

// Registro Maestro Vivo (migración 021_tabla_pagos.sql) — 4 columnas de
// `proformas` que existen en la base desde esa migración pero nunca tuvieron
// UI. A diferencia del resto de la proforma (líneas, incoterm, etc., editables
// solo en 'borrador'/'rechazada'), estos datos financieros normalmente se
// cargan DESPUÉS de que la proforma ya fue facturada/enviada al cliente —
// típico ejemplo: total_china_usd llega cuando factura el proveedor chino,
// que casi siempre es posterior a que el cliente ya aprobó su proforma. Por
// eso se manejan aparte más abajo, sin la restricción de estado.
const CAMPOS_FINANCIEROS_ADICIONALES = [
  'total_china_usd', 'acuerdo_pago',
  'perdida_usd', 'motivo_perdida',
  'nota_credito_usd', 'motivo_nota_credito',
]

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

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado para editar proformas' }, { status: 403 })
  }

  const body = await req.json()

  const { lineas, ...bodyData } = body

  // Los campos financieros adicionales (ver CAMPOS_FINANCIEROS_ADICIONALES)
  // se separan del resto antes del chequeo de estado — se pueden cargar en
  // cualquier estado de la proforma, el resto sigue restringido a
  // borrador/rechazada.
  const proformaData: Record<string, unknown> = {}
  const financierosData: Record<string, unknown> = {}
  for (const [campo, valor] of Object.entries(bodyData)) {
    if (CAMPOS_FINANCIEROS_ADICIONALES.includes(campo)) financierosData[campo] = valor
    else proformaData[campo] = valor
  }

  const hayEdicionEstandar = Object.keys(proformaData).length > 0 || lineas !== undefined

  const { data: current } = await supabase
    .from('proformas')
    .select('estado, cliente_id')
    .eq('id', params.id)
    .single()

  if (!current) return NextResponse.json({ error: 'Proforma no encontrada' }, { status: 404 })

  // Solo se puede editar el resto de la proforma en estado borrador o rechazada
  if (hayEdicionEstandar && !['borrador', 'rechazada'].includes(current.estado)) {
    return NextResponse.json({ error: `No se puede editar una proforma en estado '${current.estado}'` }, { status: 400 })
  }

  // Actualizar proforma (campos estándar + financieros en un solo update)
  const { data, error } = await supabase
    .from('proformas')
    .update({ ...proformaData, ...financierosData, updated_at: new Date().toISOString() })
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

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado para eliminar proformas' }, { status: 403 })
  }

  const { data: current } = await supabase
    .from('proformas')
    .select('estado')
    .eq('id', params.id)
    .single()

  if (current?.estado !== 'borrador') {
    return NextResponse.json({ error: 'Solo se pueden eliminar borradores' }, { status: 400 })
  }

  // Soft-delete: el número ya fue consumido de la secuencia al crear el
  // borrador y no hay forma de devolverlo, así que en vez de borrar la fila
  // (lo que además se llevaba en cascada el historial en proforma_eventos y
  // dejaba el número desaparecido sin rastro — ver migración 020) marcamos
  // el estado como 'descartada' y dejamos el evento registrado.
  const { error } = await supabase
    .from('proformas')
    .update({ estado: 'descartada', updated_at: new Date().toISOString() })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('proforma_eventos').insert({
    proforma_id: params.id,
    usuario_id: session.user.id,
    estado_desde: 'borrador',
    estado_hacia: 'descartada',
  })

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
