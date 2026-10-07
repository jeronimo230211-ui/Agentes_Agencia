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

  const { lineas, actualizado_en_cliente, ...bodyData } = body

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
    .select('estado, cliente_id, updated_at')
    .eq('id', params.id)
    .single()

  if (!current) return NextResponse.json({ error: 'Proforma no encontrada' }, { status: 404 })

  // Control de concurrencia optimista: si el formulario mandó la fecha de
  // actualización que tenía cargada y ya no coincide con la actual, alguien
  // más (u otra pestaña/sesión propia desactualizada) guardó cambios después
  // de que este formulario cargó — guardar igual pisaría ese cambio en
  // silencio. Pasó en producción el 2026-10-06 con la proforma 3-0253: una
  // edición con líneas reales quedó sobrescrita por un guardado posterior
  // con datos viejos, sin ningún error. actualizado_en_cliente es opcional
  // (compatibilidad con llamadores que todavía no lo mandan, ej. guardarFinancieros).
  if (hayEdicionEstandar && actualizado_en_cliente && current.updated_at &&
      new Date(actualizado_en_cliente).getTime() !== new Date(current.updated_at).getTime()) {
    return NextResponse.json({
      error: 'Esta proforma fue modificada en otra sesión después de que la cargaste. Recargá la página para ver los cambios más recientes antes de guardar — si guardás ahora, perderías esa edición.',
    }, { status: 409 })
  }

  // Editable en borrador/rechazada/cambios_solicitados (flujo normal antes de
  // aprobar) y también en aprobada (permite corregir datos ya aprobados sin
  // reiniciar el flujo — ver mismo permiso en cotizador/[id]/page.tsx). No
  // editable en en_revision/facturada/anulada/descartada.
  const ESTADOS_EDITABLES = ['borrador', 'rechazada', 'cambios_solicitados', 'aprobada']
  if (hayEdicionEstandar && !ESTADOS_EDITABLES.includes(current.estado)) {
    return NextResponse.json({ error: `No se puede editar una proforma en estado '${current.estado}'` }, { status: 400 })
  }

  // Salvaguarda: un guardado que mande lineas:[] sobre una proforma que YA
  // tenía líneas casi nunca es intencional (ej. un payload desactualizado de
  // una pestaña vieja, o cualquier otro bug del lado del cliente) — pasó en
  // producción el 2026-10-05 con la proforma 3-0253 (aprobada, 5 líneas,
  // quedó en 0). Si de verdad se quiere vaciar una proforma a propósito, hay
  // que mandar confirmar_vaciar:true explícito. No se valida antes de este
  // punto porque necesita el conteo real de líneas existentes.
  if (lineas !== undefined && lineas.length === 0 && !body.confirmar_vaciar) {
    const { count: lineasExistentes } = await supabase
      .from('proforma_lineas')
      .select('id', { count: 'exact', head: true })
      .eq('proforma_id', params.id)
    if ((lineasExistentes || 0) > 0) {
      return NextResponse.json({
        error: `Esta proforma ya tiene ${lineasExistentes} línea(s) guardada(s) — este guardado las dejaría en 0. Si es intencional, confirmalo explícitamente.`,
      }, { status: 409 })
    }
  }

  // Si hay edición estándar (líneas o campos del formulario), invalidar el
  // PDF cacheado para que /api/proformas/[id]/pdf lo regenere con los datos
  // nuevos la próxima vez que se pida — antes de esto, una proforma
  // 'aprobada' editada seguía sirviendo para siempre el PDF de cuando se
  // aprobó (la caché se escribió pensando que 'aprobada' era un estado
  // inmodificable, antes de permitir editarla — ver 6cf1f29). Bug real
  // reportado por Deisy 2026-10-05: el PDF no reflejaba la edición.
  if (hayEdicionEstandar) {
    proformaData.pdf_url = null
    proformaData.pdf_generado_at = null
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
    const { error: errorDelete } = await supabase.from('proforma_lineas').delete().eq('proforma_id', params.id)
    if (errorDelete) {
      console.error('[PUT /api/proformas/:id] delete proforma_lineas falló', { proforma_id: params.id, error: errorDelete })
      return NextResponse.json({ error: `No se pudieron borrar las líneas anteriores: ${errorDelete.message}` }, { status: 500 })
    }

    if (lineas.length > 0) {
      const lineasConId = lineas.map((l: Record<string, unknown>, i: number) => ({
        ...l,
        proforma_id: params.id,
        orden: i,
      }))
      // Antes este error se ignoraba por completo: si Postgres rechazaba el
      // insert (constraint, tipo de dato, lo que sea), el endpoint igual
      // respondía 200 "éxito" y la proforma quedaba con 0 líneas sin que
      // nadie se enterara — pasó en producción el 2026-10-05 y de nuevo el
      // 2026-10-06 con la proforma 3-0253. Ahora se revisa y se corta el
      // guardado completo (nada de proforma a medio guardar con líneas
      // fantasma) si el insert falla.
      const { error: errorInsert } = await supabase.from('proforma_lineas').insert(lineasConId)
      if (errorInsert) {
        console.error('[PUT /api/proformas/:id] insert proforma_lineas falló', {
          proforma_id: params.id,
          cantidad_lineas: lineas.length,
          primera_linea: lineasConId[0],
          error: errorInsert,
        })
        return NextResponse.json({ error: `No se pudieron guardar las líneas: ${errorInsert.message}` }, { status: 500 })
      }
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
