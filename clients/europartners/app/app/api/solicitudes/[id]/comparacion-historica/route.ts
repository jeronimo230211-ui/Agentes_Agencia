import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { precioPorTipo } from '@/lib/precio'
import type { TipoPrecio } from '@/types/europartners'

type Params = { params: { id: string } }

interface LineaComparacion {
  linea_id: string
  codigo: string | null
  tiene_historial: boolean
  ultimo_precio_cliente: number | null
  ultima_fecha: string | null
  ultimo_proforma_numero: string | null
  veces_comprado: number
  precio_catalogo_actual: number | null
  diferencia_usd: number | null
  diferencia_pct: number | null
  tendencia: 'subio' | 'bajo' | 'igual' | 'sin_datos'
}

// Para cada línea de la solicitud, busca el último precio que se le dio a ESTE cliente específico
// para ese código de producto (historial_precios) y lo compara contra el precio de catálogo vigente
// hoy — así Deisy/Marta ven de un vistazo si el precio subió o bajó desde la última vez que este
// cliente compró ese artículo, antes de decidir el precio de la proforma nueva.
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: solicitud, error: eSol } = await supabase
    .from('solicitudes')
    .select(`
      cliente_id,
      cliente:clientes(tipo),
      lineas:solicitud_lineas(id, producto_id, producto:productos(codigo, precio_mayorista, precio_detallista))
    `)
    .eq('id', params.id)
    .single()

  if (eSol || !solicitud) return NextResponse.json({ error: eSol?.message || 'Solicitud no encontrada' }, { status: 404 })

  const clienteJoin = solicitud.cliente as { tipo?: TipoPrecio } | { tipo?: TipoPrecio }[] | null
  const cliente = Array.isArray(clienteJoin) ? clienteJoin[0] : clienteJoin
  const tipoPrecio: TipoPrecio = cliente?.tipo || 'mayorista'

  type LineaConProducto = {
    id: string
    producto_id: string | null
    producto: { codigo?: string; precio_mayorista?: number; precio_detallista?: number } | { codigo?: string; precio_mayorista?: number; precio_detallista?: number }[] | null
  }
  const lineas = (solicitud.lineas || []) as LineaConProducto[]

  const codigos = Array.from(new Set(
    lineas
      .map(l => (Array.isArray(l.producto) ? l.producto[0] : l.producto)?.codigo)
      .filter((c): c is string => Boolean(c))
  ))

  const historialPorCodigo = new Map<string, { precio_cliente_usd: number; fecha_proforma: string | null; proforma_numero: string | null }[]>()

  if (codigos.length > 0) {
    const { data: historial } = await supabase
      .from('historial_precios')
      .select('codigo_pdf, precio_cliente_usd, fecha_proforma, proforma_numero')
      .eq('cliente_id', solicitud.cliente_id)
      .in('codigo_pdf', codigos)
      .not('precio_cliente_usd', 'is', null)
      .order('fecha_proforma', { ascending: false })

    for (const h of historial || []) {
      if (!h.codigo_pdf) continue
      const arr = historialPorCodigo.get(h.codigo_pdf) || []
      arr.push({ precio_cliente_usd: h.precio_cliente_usd, fecha_proforma: h.fecha_proforma, proforma_numero: h.proforma_numero })
      historialPorCodigo.set(h.codigo_pdf, arr)
    }
  }

  const resultado: LineaComparacion[] = lineas.map(l => {
    const producto = Array.isArray(l.producto) ? l.producto[0] : l.producto
    const codigo = producto?.codigo || null
    const registros = codigo ? historialPorCodigo.get(codigo) : undefined
    const ultimo = registros?.[0]
    const precioCatalogo = precioPorTipo(producto?.precio_mayorista, producto?.precio_detallista, tipoPrecio) ?? null

    let diferenciaUsd: number | null = null
    let diferenciaPct: number | null = null
    let tendencia: LineaComparacion['tendencia'] = 'sin_datos'

    if (ultimo && precioCatalogo != null) {
      diferenciaUsd = Math.round((precioCatalogo - ultimo.precio_cliente_usd) * 100) / 100
      diferenciaPct = ultimo.precio_cliente_usd ? diferenciaUsd / ultimo.precio_cliente_usd : null
      tendencia = diferenciaUsd > 0.005 ? 'subio' : diferenciaUsd < -0.005 ? 'bajo' : 'igual'
    }

    return {
      linea_id: l.id,
      codigo,
      tiene_historial: Boolean(ultimo),
      ultimo_precio_cliente: ultimo?.precio_cliente_usd ?? null,
      ultima_fecha: ultimo?.fecha_proforma ?? null,
      ultimo_proforma_numero: ultimo?.proforma_numero ?? null,
      veces_comprado: registros?.length ?? 0,
      precio_catalogo_actual: precioCatalogo,
      diferencia_usd: diferenciaUsd,
      diferencia_pct: diferenciaPct,
      tendencia,
    }
  })

  return NextResponse.json({ data: { tipo_precio: tipoPrecio, lineas: resultado } })
}
