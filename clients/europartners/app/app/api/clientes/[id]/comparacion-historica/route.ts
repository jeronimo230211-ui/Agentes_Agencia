import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { precioPorTipo } from '@/lib/precio'
import type { TipoPrecio } from '@/types/europartners'

type Params = { params: { id: string } }

export interface OtroClienteReferencia {
  cliente_nombre: string
  tipo: TipoPrecio
  precio_cliente_usd: number
  fecha_proforma: string | null
  proforma_numero: string | null
}

export interface ComparacionPrecio {
  codigo: string
  tiene_historial: boolean
  ultimo_precio_cliente: number | null
  ultima_fecha: string | null
  ultimo_proforma_numero: string | null
  veces_comprado: number
  precio_catalogo_actual: number | null
  diferencia_usd: number | null
  diferencia_pct: number | null
  tendencia: 'subio' | 'bajo' | 'igual' | 'sin_datos'
  otros_clientes: OtroClienteReferencia[]
}

// Misma comparación que /api/solicitudes/[id]/comparacion-historica, pero por cliente+códigos
// en lugar de por solicitud — para el cotizador manual, donde las líneas se arman una a una y
// no existen como registro de solicitud.
export async function GET(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const codigos = Array.from(new Set(
    (req.nextUrl.searchParams.get('codigos') || '').split(',').map(c => c.trim()).filter(Boolean)
  ))
  if (codigos.length === 0) return NextResponse.json({ data: { tipo_precio: 'mayorista', comparaciones: [] } })

  const { data: cliente, error: eCliente } = await supabase
    .from('clientes')
    .select('tipo')
    .eq('id', params.id)
    .single()

  if (eCliente || !cliente) return NextResponse.json({ error: eCliente?.message || 'Cliente no encontrado' }, { status: 404 })
  const tipoPrecio: TipoPrecio = cliente.tipo || 'mayorista'

  const { data: productos } = await supabase
    .from('productos')
    .select('codigo, precio_mayorista, precio_detallista')
    .in('codigo', codigos)

  const precioPorCodigo = new Map((productos || []).map(p => [p.codigo, p]))

  const { data: historial } = await supabase
    .from('historial_precios')
    .select('codigo_pdf, precio_cliente_usd, fecha_proforma, proforma_numero')
    .eq('cliente_id', params.id)
    .in('codigo_pdf', codigos)
    .not('precio_cliente_usd', 'is', null)
    .order('fecha_proforma', { ascending: false })

  const historialPorCodigo = new Map<string, { precio_cliente_usd: number; fecha_proforma: string | null; proforma_numero: string | null }[]>()
  for (const h of historial || []) {
    if (!h.codigo_pdf) continue
    const arr = historialPorCodigo.get(h.codigo_pdf) || []
    arr.push({ precio_cliente_usd: h.precio_cliente_usd, fecha_proforma: h.fecha_proforma, proforma_numero: h.proforma_numero })
    historialPorCodigo.set(h.codigo_pdf, arr)
  }

  // Para los códigos sin historial propio, buscar qué precio se le dio a otros clientes —
  // hasta 2 referencias por código, priorizando clientes del mismo tipo (mayorista/detallista).
  const codigosSinHistorial = codigos.filter(c => !historialPorCodigo.has(c))
  const recomendacionesPorCodigo = new Map<string, OtroClienteReferencia[]>()

  if (codigosSinHistorial.length > 0) {
    const { data: otrosClientes } = await supabase
      .from('historial_precios')
      .select('codigo_pdf, precio_cliente_usd, fecha_proforma, proforma_numero, cliente_id, cliente:clientes(nombre, tipo)')
      .in('codigo_pdf', codigosSinHistorial)
      .neq('cliente_id', params.id)
      .not('precio_cliente_usd', 'is', null)
      .order('fecha_proforma', { ascending: false })

    type RegistroOtroCliente = {
      codigo_pdf: string | null
      precio_cliente_usd: number
      fecha_proforma: string | null
      proforma_numero: string | null
      cliente_id: string
      cliente: { nombre?: string; tipo?: TipoPrecio } | { nombre?: string; tipo?: TipoPrecio }[] | null
    }

    const porCodigo = new Map<string, RegistroOtroCliente[]>()
    for (const h of (otrosClientes || []) as RegistroOtroCliente[]) {
      if (!h.codigo_pdf) continue
      const arr = porCodigo.get(h.codigo_pdf) || []
      arr.push(h)
      porCodigo.set(h.codigo_pdf, arr)
    }

    for (const [codigo, registros] of Array.from(porCodigo.entries())) {
      const mismoTipo = registros.filter(r => (Array.isArray(r.cliente) ? r.cliente[0] : r.cliente)?.tipo === tipoPrecio)
      const otroTipo = registros.filter(r => !mismoTipo.includes(r))
      const vistos = new Set<string>()
      const recs: OtroClienteReferencia[] = []
      for (const r of [...mismoTipo, ...otroTipo]) {
        if (vistos.has(r.cliente_id)) continue
        vistos.add(r.cliente_id)
        const cli = Array.isArray(r.cliente) ? r.cliente[0] : r.cliente
        recs.push({
          cliente_nombre: cli?.nombre || 'Cliente',
          tipo: cli?.tipo || 'mayorista',
          precio_cliente_usd: r.precio_cliente_usd,
          fecha_proforma: r.fecha_proforma,
          proforma_numero: r.proforma_numero,
        })
        if (recs.length >= 2) break
      }
      recomendacionesPorCodigo.set(codigo, recs)
    }
  }

  const comparaciones: ComparacionPrecio[] = codigos.map(codigo => {
    const producto = precioPorCodigo.get(codigo)
    const registros = historialPorCodigo.get(codigo)
    const ultimo = registros?.[0]
    const precioCatalogo = precioPorTipo(producto?.precio_mayorista, producto?.precio_detallista, tipoPrecio) ?? null

    let diferenciaUsd: number | null = null
    let diferenciaPct: number | null = null
    let tendencia: ComparacionPrecio['tendencia'] = 'sin_datos'

    if (ultimo && precioCatalogo != null) {
      diferenciaUsd = Math.round((precioCatalogo - ultimo.precio_cliente_usd) * 100) / 100
      diferenciaPct = ultimo.precio_cliente_usd ? diferenciaUsd / ultimo.precio_cliente_usd : null
      tendencia = diferenciaUsd > 0.005 ? 'subio' : diferenciaUsd < -0.005 ? 'bajo' : 'igual'
    }

    return {
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
      otros_clientes: !ultimo ? (recomendacionesPorCodigo.get(codigo) || []) : [],
    }
  })

  return NextResponse.json({ data: { tipo_precio: tipoPrecio, comparaciones } })
}
