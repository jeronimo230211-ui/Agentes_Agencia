import { NextResponse } from 'next/server'
import { getCurrentUsuario } from '@/lib/auth'

// GET /api/dashboard/indicadores-estrategicos — datos del tab "Estratégico"
// del Panel de la CEO (dashboard). Acceso: admin + analista, mismo criterio
// que /api/finanzas y /api/reportes/tiempos-por-usuario (información
// analítica/de margen, no la cola de acción de operaciones).
//
// Fuente: las 4 vistas de solo lectura de la migración 029
// (concentracion_clientes_v, concentracion_paises_v, rentabilidad_por_cliente_v,
// margen_por_categoria_v, catalogo_desactualizado_rechazos_v) + 3 agregados
// calculados aquí mismo sobre `proformas` y `proformas_deuda_vivo` (vista ya
// en producción desde la migración 021, la misma que usa /api/finanzas):
// % de proformas perdidas, deuda viva y pérdidas/notas de crédito.
//
// Nota sobre los umbrales de semáforo: el diseño aprobado por Jero fija los
// umbrales de "Concentración de clientes y países" (>30%/85% rojo,
// 20-30%/70-85% amarillo). Para los otros 6 KPIs no se definieron umbrales
// exactos — se calculan en el frontend con valores conservadores razonables,
// documentados ahí. Si Marta/Jero quieren calibrarlos con casos reales,
// es trabajo de data-analyst, no de este endpoint.

const ROLES_ESTRATEGICO = ['admin', 'analista']

interface ConcentracionClienteRow {
  cliente_id: string
  cliente_nombre: string
  pais: string | null
  total_usd: number
  pct_del_total: number
}

interface ConcentracionPaisRow {
  pais: string
  total_usd: number
  pct_del_total: number
}

interface RentabilidadClienteRow {
  cliente_id: string
  cliente_nombre: string
  margen_min: number | null
  margen_max: number | null
  margen_ponderado_pct: number | null
  n_lineas_con_margen: number
  n_lineas_total: number
}

interface MargenCategoriaRow {
  categoria_id: string | null
  categoria_nombre: string
  margen_ponderado_pct: number | null
  n_lineas_con_margen: number
  n_lineas_total: number
}

interface CatalogoDesactualizadoRow {
  proforma_id: string
  numero: string
  fecha_rechazo: string
  cliente_id: string
  cliente_nombre: string
  motivo_rechazo: string | null
  n_lineas: number
  precio_fob_fecha_mas_antigua: string | null
  precio_fob_fecha_mas_reciente: string | null
  dias_desde_actualizacion_precio_max: number | null
}

interface ProformaRow {
  id: string
  numero: string
  estado: string
  cliente_id: string
  total_cif_usd: number | null
  total_fob_usd: number | null
  perdida_usd: number | null
  motivo_perdida: string | null
  nota_credito_usd: number | null
  motivo_nota_credito: string | null
}

interface DeudaVivoRow {
  proforma_id: string
  numero: string
  deuda_cliente_usd: number | null
  deuda_china_usd: number | null
}

const ESTADOS_PERDIDA = ['borrador', 'rechazada', 'anulada']

export async function GET() {
  const ctx = await getCurrentUsuario()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!ROLES_ESTRATEGICO.includes(ctx.usuario.rol)) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }
  const { supabase } = ctx

  // Las 4 vistas de la migración 029 + clientes (para nombres en deuda viva,
  // que `proformas_deuda_vivo` no trae) + proformas completas (para los 3
  // agregados) se piden en paralelo -- son independientes entre sí.
  const [
    concentracionClientesRes,
    concentracionPaisesRes,
    rentabilidadClienteRes,
    margenCategoriaRes,
    catalogoDesactualizadoRes,
    clientesRes,
    proformasRes,
  ] = await Promise.all([
    supabase.from('concentracion_clientes_v').select('*'),
    supabase.from('concentracion_paises_v').select('*'),
    supabase.from('rentabilidad_por_cliente_v').select('*'),
    supabase.from('margen_por_categoria_v').select('*'),
    supabase.from('catalogo_desactualizado_rechazos_v').select('*'),
    supabase.from('clientes').select('id, nombre'),
    supabase
      .from('proformas')
      .select('id, numero, estado, cliente_id, total_cif_usd, total_fob_usd, perdida_usd, motivo_perdida, nota_credito_usd, motivo_nota_credito'),
  ])

  // Regla de datos de la agencia: nunca tragar un error de la BD -- si
  // cualquiera de estas 7 consultas de solo lectura falla, se corta con un
  // 500 real en vez de devolver 200 con un indicador a medias o en null.
  const fallas = [
    { nombre: 'concentracion_clientes_v', error: concentracionClientesRes.error },
    { nombre: 'concentracion_paises_v', error: concentracionPaisesRes.error },
    { nombre: 'rentabilidad_por_cliente_v', error: rentabilidadClienteRes.error },
    { nombre: 'margen_por_categoria_v', error: margenCategoriaRes.error },
    { nombre: 'catalogo_desactualizado_rechazos_v', error: catalogoDesactualizadoRes.error },
    { nombre: 'clientes', error: clientesRes.error },
    { nombre: 'proformas', error: proformasRes.error },
  ].filter(f => f.error)
  if (fallas.length > 0) {
    console.error('[indicadores-estrategicos] error consultando:', fallas.map(f => `${f.nombre}: ${f.error?.message}`).join(' | '))
    return NextResponse.json({ error: 'No se pudieron cargar los indicadores estratégicos' }, { status: 500 })
  }

  const clientesPorId = new Map((clientesRes.data || []).map(c => [c.id as string, c.nombre as string]))
  const proformas = (proformasRes.data || []) as ProformaRow[]

  // ── % de proformas perdidas ──────────────────────────────────────
  // Mismo criterio acordado con Marta/Jero: borrador + rechazada + anulada
  // sobre el total de proformas (no solo las del período visible en pantalla).
  const porEstadoPerdida: Record<string, number> = { borrador: 0, rechazada: 0, anulada: 0 }
  for (const p of proformas) {
    if (ESTADOS_PERDIDA.includes(p.estado)) porEstadoPerdida[p.estado] = (porEstadoPerdida[p.estado] || 0) + 1
  }
  const nPerdidas = Object.values(porEstadoPerdida).reduce((a, b) => a + b, 0)
  const proformasPerdidas = {
    pct: proformas.length > 0 ? Math.round((nPerdidas / proformas.length) * 1000) / 10 : 0,
    n_perdidas: nPerdidas,
    n_total: proformas.length,
    por_estado: porEstadoPerdida,
  }

  // ── Deuda viva ─────────────────────────────────────────────────────
  // Solo sobre proformas ya facturadas al cliente (enviada/facturada) --
  // mismo criterio de "facturación real" de toda esta migración. Las demás
  // (borrador/en_revision/aprobada sin enviar) no tienen deuda real todavía
  // aunque `proformas_deuda_vivo` les calcule un total_facturado desde el
  // total de la cotización -- ver nota de ese cálculo en /api/finanzas.
  const idsFacturadas = proformas.filter(p => p.estado === 'enviada' || p.estado === 'facturada').map(p => p.id)
  let deudaRows: DeudaVivoRow[] = []
  if (idsFacturadas.length > 0) {
    const { data, error } = await supabase
      .from('proformas_deuda_vivo')
      .select('proforma_id, numero, deuda_cliente_usd, deuda_china_usd')
      .in('proforma_id', idsFacturadas)
    if (error) {
      console.error('[indicadores-estrategicos] error consultando proformas_deuda_vivo:', error.message)
      return NextResponse.json({ error: 'No se pudieron cargar los indicadores estratégicos' }, { status: 500 })
    }
    deudaRows = (data || []) as DeudaVivoRow[]
  }
  const proformaPorId = new Map(proformas.map(p => [p.id, p]))
  // Se recorta a 0 por fila (no se suman saldos negativos de proformas
  // sobrepagadas, que restarían de la deuda viva real de otras).
  const deudaConMonto = deudaRows
    .map(d => ({
      ...d,
      deuda_cliente_usd: Math.max(0, d.deuda_cliente_usd ?? 0),
      deuda_china_usd: d.deuda_china_usd != null ? Math.max(0, d.deuda_china_usd) : null,
    }))
    .filter(d => d.deuda_cliente_usd > 0)
  const deudaViva = {
    total_deuda_cliente_usd: deudaConMonto.reduce((a, d) => a + d.deuda_cliente_usd, 0),
    total_deuda_china_usd: deudaConMonto.reduce((a, d) => a + (d.deuda_china_usd ?? 0), 0),
    n_proformas_con_deuda: deudaConMonto.length,
    top: deudaConMonto
      .sort((a, b) => b.deuda_cliente_usd - a.deuda_cliente_usd)
      .slice(0, 5)
      .map(d => ({
        proforma_id: d.proforma_id,
        numero: d.numero,
        cliente_nombre: clientesPorId.get(proformaPorId.get(d.proforma_id)?.cliente_id ?? '') ?? '—',
        deuda_cliente_usd: d.deuda_cliente_usd,
        deuda_china_usd: d.deuda_china_usd,
      })),
  }

  // ── Pérdidas / notas de crédito ─────────────────────────────────────
  const conPerdidaONota = proformas.filter(p => (p.perdida_usd ?? 0) > 0 || (p.nota_credito_usd ?? 0) > 0)
  const perdidasNotasCredito = {
    total_perdida_usd: proformas.reduce((a, p) => a + (p.perdida_usd ?? 0), 0),
    total_nota_credito_usd: proformas.reduce((a, p) => a + (p.nota_credito_usd ?? 0), 0),
    filas: conPerdidaONota
      .sort((a, b) => ((b.perdida_usd ?? 0) + (b.nota_credito_usd ?? 0)) - ((a.perdida_usd ?? 0) + (a.nota_credito_usd ?? 0)))
      .slice(0, 5)
      .map(p => ({
        proforma_id: p.id,
        numero: p.numero,
        cliente_nombre: clientesPorId.get(p.cliente_id) ?? '—',
        perdida_usd: p.perdida_usd,
        motivo_perdida: p.motivo_perdida,
        nota_credito_usd: p.nota_credito_usd,
        motivo_nota_credito: p.motivo_nota_credito,
      })),
  }

  return NextResponse.json({
    concentracion_clientes: (concentracionClientesRes.data || []) as ConcentracionClienteRow[],
    concentracion_paises: (concentracionPaisesRes.data || []) as ConcentracionPaisRow[],
    rentabilidad_por_cliente: (rentabilidadClienteRes.data || []) as RentabilidadClienteRow[],
    margen_por_categoria: (margenCategoriaRes.data || []) as MargenCategoriaRow[],
    catalogo_desactualizado: (catalogoDesactualizadoRes.data || []) as CatalogoDesactualizadoRow[],
    proformas_perdidas: proformasPerdidas,
    deuda_viva: deudaViva,
    perdidas_notas_credito: perdidasNotasCredito,
  })
}
