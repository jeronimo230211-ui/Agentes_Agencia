'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  FileText, CheckCircle, Send, Clock, TrendingUp, AlertCircle, DollarSign, Ship, Inbox,
  Users, Percent, Tag, XCircle, RefreshCw, Wallet, TrendingDown,
} from 'lucide-react'
import Link from 'next/link'
import { formatUSD } from '@/lib/precio'
import { supabase } from '@/lib/supabase'
import MisPendientesPanel from '@/components/MisPendientesPanel'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import StatCard from '@/components/ui/StatCard'
import DataTable from '@/components/ui/DataTable'
import SeccionColapsable from '@/components/ui/SeccionColapsable'
import RankedBarList, { type RankedBarListItem } from '@/components/ui/RankedBarList'
import Meter, { type Nivel } from '@/components/ui/Meter'
import type { Proforma, Usuario } from '@/types/europartners'

interface KPIs {
  recientes: Proforma[]
}

interface MargenStats { min: number; max: number; avg: number; n: number }

interface StatsCEO {
  facturacion_total: number
  otif: { total_entregados: number; a_tiempo: number; pct: number | null }
  tiempos_por_etapa: { etapa: string; promedio_horas: number; muestras: number }[]
  pipeline: {
    solicitudes_pendientes: number
    proformas: Record<string, number>
    despachos: Record<string, number>
  }
  margenes_catalogo: { mayorista: MargenStats | null; detallista: MargenStats | null }
}

interface Cliente { id: string; nombre: string; tipo: string }
interface ParametroPrecio { id: string; nombre: string; flete_usd: number; arancel_pct: number; cbm_total_contenedor: number; valido_desde: string }

function fechaLabel(horas: number) {
  if (horas < 24) return `${horas.toFixed(1)} h`
  return `${(horas / 24).toFixed(1)} días`
}

// ── Tab "Estratégico" dentro de la sección colapsable "KPIs" (solo
// admin/analista). Tipos del GET /api/dashboard/indicadores-estrategicos,
// ver ese archivo para la fuente de cada campo (vistas de la migración 029 +
// 3 agregados).
interface ConcentracionCliente { cliente_id: string; cliente_nombre: string; pais: string | null; total_usd: number; pct_del_total: number }
interface ConcentracionPais { pais: string; total_usd: number; pct_del_total: number }
interface RentabilidadCliente {
  cliente_id: string; cliente_nombre: string
  // min/max del rango de margen del cliente -- vienen de rentabilidad_por_cliente_v
  // (ver route.ts), se usan como banda de referencia (bullet-chart) contra el
  // margen real en TileRentabilidadPorCliente.
  margen_min: number | null; margen_max: number | null
  margen_ponderado_pct: number | null; n_lineas_con_margen: number; n_lineas_total: number
}
interface MargenCategoria {
  categoria_id: string | null; categoria_nombre: string
  margen_ponderado_pct: number | null; n_lineas_con_margen: number; n_lineas_total: number
}
interface CatalogoDesactualizadoRow {
  proforma_id: string; numero: string; fecha_rechazo: string; cliente_nombre: string
  motivo_rechazo: string | null; dias_desde_actualizacion_precio_max: number | null
}
interface ProformasPerdidas { pct: number; n_perdidas: number; n_total: number; por_estado: Record<string, number> }
interface DeudaVivaFila { proforma_id: string; numero: string; cliente_nombre: string; deuda_cliente_usd: number; deuda_china_usd: number | null }
interface DeudaViva { total_deuda_cliente_usd: number; total_deuda_china_usd: number; n_proformas_con_deuda: number; top: DeudaVivaFila[] }
interface PerdidaNotaCreditoFila {
  proforma_id: string; numero: string; cliente_nombre: string
  perdida_usd: number | null; motivo_perdida: string | null
  nota_credito_usd: number | null; motivo_nota_credito: string | null
}
interface PerdidasNotasCredito { total_perdida_usd: number; total_nota_credito_usd: number; filas: PerdidaNotaCreditoFila[] }

interface IndicadoresEstrategicos {
  concentracion_clientes: ConcentracionCliente[]
  concentracion_paises: ConcentracionPais[]
  rentabilidad_por_cliente: RentabilidadCliente[]
  margen_por_categoria: MargenCategoria[]
  catalogo_desactualizado: CatalogoDesactualizadoRow[]
  proformas_perdidas: ProformasPerdidas
  deuda_viva: DeudaViva
  perdidas_notas_credito: PerdidasNotasCredito
}

type TabCEO = 'operativo' | 'estrategico'

function formatPct(n: number | null, decimals = 1) {
  return n == null ? '—' : `${n.toFixed(decimals)}%`
}

// Umbrales de semáforo: los de concentración son los exactos que aprobó Jero
// (diseño de ui-ux-designer). Los de los otros 5 indicadores (margen, %
// perdidas, catálogo, deuda viva, pérdidas/notas) NO vinieron con un número
// exacto en el encargo -- son valores conservadores razonables puestos por
// agency-developer, documentados acá para que data-analyst los calibre con
// casos reales si Marta/Jero lo piden.
function nivelConcentracion(pctCliente: number, pctPais: number): Nivel {
  if (pctCliente > 30 || pctPais > 85) return 'bad'
  if (pctCliente >= 20 || pctPais >= 70) return 'warn'
  return 'ok'
}
function nivelMargen(avgPct: number | null): Nivel {
  if (avgPct == null) return 'warn'
  if (avgPct < 10) return 'bad'
  if (avgPct < 20) return 'warn'
  return 'ok'
}
function nivelPerdidas(pct: number): Nivel {
  if (pct > 20) return 'bad'
  if (pct > 10) return 'warn'
  return 'ok'
}
function nivelCatalogo(n: number): Nivel {
  if (n === 0) return 'ok'
  if (n <= 3) return 'warn'
  return 'bad'
}
function nivelDeuda(totalDeuda: number, facturacionTotal: number): Nivel {
  if (totalDeuda <= 0) return 'ok'
  if (facturacionTotal <= 0) return 'warn'
  const ratio = totalDeuda / facturacionTotal
  if (ratio > 0.25) return 'bad'
  if (ratio > 0.10) return 'warn'
  return 'ok'
}
function nivelPerdidasNotas(total: number): Nivel {
  if (total <= 0) return 'ok'
  if (total < 1000) return 'warn'
  return 'bad'
}

function SemaforoDot({ nivel }: { nivel: Nivel }) {
  const cls = nivel === 'bad' ? 'bg-danger' : nivel === 'warn' ? 'bg-warning' : 'bg-success'
  const label = nivel === 'bad' ? 'Alerta' : nivel === 'warn' ? 'Atención' : 'Saludable'
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${cls}`} title={label} aria-label={label} />
}

function ErrorIndicadores({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="bg-danger-bg border border-danger rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <AlertCircle size={18} className="text-danger flex-shrink-0" />
        <p className="text-sm font-medium text-danger">No se pudieron cargar los indicadores</p>
      </div>
      <button onClick={onRetry} className="text-sm font-medium text-danger underline hover:no-underline">
        Reintentar
      </button>
    </div>
  )
}

function SkeletonEstrategico() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="bg-bg-surface rounded-xl border border-border p-5">
        <div className="h-4 w-56 bg-bg-subtle rounded mb-4" />
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="h-12 bg-bg-subtle rounded" />
          <div className="h-12 bg-bg-subtle rounded" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-bg-surface rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="h-9 w-9 bg-bg-subtle rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 bg-bg-subtle rounded" />
              <div className="h-4 w-16 bg-bg-subtle rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// "Concentración de clientes y países" -- la card en sí SIEMPRE está
// expandida (nunca colapsada); el "Ver detalle" es la única parte que se
// abre/cierra (vía SeccionColapsable variante "link", reusando el mismo
// patrón botón+chevron+aria-expanded del resto del dashboard).
function ConcentracionCard({
  clientes, paises,
}: { clientes: ConcentracionCliente[]; paises: ConcentracionPais[] }) {
  if (clientes.length === 0) {
    return (
      <div className="bg-bg-surface rounded-xl shadow-sm border border-border p-5">
        <h3 className="font-bold text-text flex items-center gap-2 mb-2">
          <Users size={16} className="text-text-heading" /> Concentración de clientes y países
        </h3>
        <p className="text-sm text-text-subtle">Sin clientes registrados todavía</p>
      </div>
    )
  }

  const topCliente = [...clientes].sort((a, b) => b.pct_del_total - a.pct_del_total)[0]
  const topPais = paises.length > 0 ? [...paises].sort((a, b) => b.pct_del_total - a.pct_del_total)[0] : null
  const nivel = nivelConcentracion(topCliente.pct_del_total, topPais?.pct_del_total ?? 0)

  // max=100: a diferencia de los demás RankedBarList del dashboard (que
  // escalan al valor más alto de su propia lista), estas barras son % del
  // total -- tienen que compararse contra el 100% completo, no solo entre
  // ellas, para que la barra sí comunique "qué tan concentrado" está.
  const itemsClientes: RankedBarListItem[] = [...clientes]
    .sort((a, b) => b.pct_del_total - a.pct_del_total)
    .map(c => ({ id: c.cliente_id, label: c.cliente_nombre, value: c.pct_del_total, valueLabel: `${c.pct_del_total.toFixed(1)}% · ${formatUSD(c.total_usd)}` }))
  const itemsPaises: RankedBarListItem[] = [...paises]
    .sort((a, b) => b.pct_del_total - a.pct_del_total)
    .map(p => ({ id: p.pais, label: p.pais, value: p.pct_del_total, valueLabel: `${p.pct_del_total.toFixed(1)}% · ${formatUSD(p.total_usd)}` }))

  return (
    <div className="bg-bg-surface rounded-xl shadow-sm border border-border p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-bold text-text flex items-center gap-2">
          <Users size={16} className="text-text-heading" /> Concentración de clientes y países
        </h3>
        <SemaforoDot nivel={nivel} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-xs font-semibold text-text-subtle uppercase mb-1">Top cliente</p>
          <p className="text-heading-2 text-text-heading">{formatPct(topCliente.pct_del_total)}</p>
          <p className="text-sm text-text-muted truncate">{topCliente.cliente_nombre}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-text-subtle uppercase mb-1">Top país</p>
          <p className="text-heading-2 text-text-heading">{topPais ? formatPct(topPais.pct_del_total) : '—'}</p>
          <p className="text-sm text-text-muted truncate">{topPais?.pais ?? '—'}</p>
        </div>
      </div>
      <SeccionColapsable variante="link" titulo="Ver detalle" tituloAbierto="Ocultar detalle">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-text-subtle uppercase mb-2">Clientes</p>
            <div className="max-h-64 overflow-y-auto pr-1">
              <RankedBarList items={itemsClientes} max={100} />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle uppercase mb-2">Países</p>
            <div className="max-h-64 overflow-y-auto pr-1">
              <RankedBarList items={itemsPaises} max={100} />
            </div>
          </div>
        </div>
      </SeccionColapsable>
    </div>
  )
}

function TileRentabilidadPorCliente({ rows }: { rows: RentabilidadCliente[] }) {
  const validos = rows.filter(r => r.margen_ponderado_pct != null)
  const avg = validos.length > 0 ? validos.reduce((a, r) => a + (r.margen_ponderado_pct as number), 0) / validos.length : null
  const top5 = [...validos].sort((a, b) => (b.margen_ponderado_pct as number) - (a.margen_ponderado_pct as number)).slice(0, 5)
  // Banda clara (margen_min-margen_max del cliente) vs. barra oscura (margen
  // real ponderado) -- bullet-chart: si la barra oscura cae dentro de la
  // banda, el cliente está cotizando dentro de su rango normal.
  const items: RankedBarListItem[] = top5.map(r => ({
    id: r.cliente_id,
    label: r.cliente_nombre,
    value: r.margen_ponderado_pct as number,
    valueLabel: `${(r.margen_ponderado_pct as number).toFixed(1)}% · ${r.n_lineas_con_margen}/${r.n_lineas_total} líneas`,
    bandMin: r.margen_min,
    bandMax: r.margen_max,
  }))
  return (
    <SeccionColapsable
      variante="tile"
      icon={Percent}
      titulo="Rentabilidad por cliente"
      headline={avg != null ? `${avg.toFixed(1)}% prom.` : '—'}
      indicador={<SemaforoDot nivel={nivelMargen(avg)} />}
    >
      {validos.length === 0 ? (
        <p className="text-sm text-text-subtle">Sin datos de margen disponibles todavía</p>
      ) : (
        <div>
          <p className="text-xs text-text-subtle mb-2">Top 5 clientes por margen · banda clara = rango min-max del cliente</p>
          <RankedBarList items={items} />
        </div>
      )}
    </SeccionColapsable>
  )
}

function TileMargenPorCategoria({ rows }: { rows: MargenCategoria[] }) {
  const sinCategoria = rows.find(r => r.categoria_nombre.startsWith('Sin categoría'))
  const reales = rows.filter(r => r.margen_ponderado_pct != null && !r.categoria_nombre.startsWith('Sin categoría'))
  const avg = reales.length > 0 ? reales.reduce((a, r) => a + (r.margen_ponderado_pct as number), 0) / reales.length : null
  const top5 = [...reales].sort((a, b) => (b.margen_ponderado_pct as number) - (a.margen_ponderado_pct as number)).slice(0, 5)
  const items: RankedBarListItem[] = top5.map(r => ({
    id: r.categoria_id ?? r.categoria_nombre,
    label: r.categoria_nombre,
    value: r.margen_ponderado_pct as number,
    valueLabel: `${(r.margen_ponderado_pct as number).toFixed(1)}% · ${r.n_lineas_con_margen}/${r.n_lineas_total} líneas`,
  }))
  return (
    <SeccionColapsable
      variante="tile"
      icon={Tag}
      titulo="Margen por categoría"
      headline={avg != null ? `${avg.toFixed(1)}% prom.` : '—'}
      indicador={<SemaforoDot nivel={nivelMargen(avg)} />}
    >
      {reales.length === 0 ? (
        <p className="text-sm text-text-subtle">Sin datos de margen disponibles todavía</p>
      ) : (
        <div className="space-y-2">
          <RankedBarList items={items} />
          {sinCategoria && (
            <p className="text-xs text-text-subtle pt-2 border-t border-border">
              {sinCategoria.n_lineas_total} líneas ({sinCategoria.n_lineas_con_margen} con margen calculable) sin categoría asignable — no entran en el promedio
            </p>
          )}
        </div>
      )}
    </SeccionColapsable>
  )
}

function TileProformasPerdidas({ data }: { data: ProformasPerdidas }) {
  const nivel = nivelPerdidas(data.pct)
  return (
    <SeccionColapsable
      variante="tile"
      icon={XCircle}
      titulo="Proformas perdidas"
      headline={`${data.pct.toFixed(1)}%`}
      indicador={<SemaforoDot nivel={nivel} />}
    >
      {data.n_perdidas === 0 ? (
        <p className="text-sm text-text-subtle">Sin proformas perdidas (borrador, rechazadas o anuladas)</p>
      ) : (
        <div className="space-y-3">
          {/* Meter, no una barra segmentada de 3 colores -- rechazada y
              anulada ya comparten "danger" vía ESTADO_VARIANT en todo el
              proyecto, inventar una 3ra categoría de color rompería esa
              convención. El desglose por estado se queda en texto plano. */}
          <Meter valor={data.pct} marcas={[10, 20]} nivel={nivel} label={`${data.pct.toFixed(1)}% de proformas perdidas`} />
          <div className="space-y-1.5">
            <p className="text-xs text-text-subtle mb-1">{data.n_perdidas} de {data.n_total} proformas</p>
            {(['borrador', 'rechazada', 'anulada'] as const).map(estado => (
              <div key={estado} className="flex items-center justify-between text-sm">
                <span className="text-text-muted capitalize">{estado}</span>
                <span className="font-medium text-text">{data.por_estado[estado] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SeccionColapsable>
  )
}

// Catálogo desactualizado: hoy son casos chicos (conteo bajo) -- la lista de
// CUÁLES proformas son es lo que importa, no la magnitud. Sin gráfica a
// propósito, no se le pone una barra solo por consistencia con los demás tiles.
function TileCatalogoDesactualizado({ rows }: { rows: CatalogoDesactualizadoRow[] }) {
  return (
    <SeccionColapsable
      variante="tile"
      icon={RefreshCw}
      titulo="Catálogo desactualizado"
      headline={`${rows.length}`}
      indicador={<SemaforoDot nivel={nivelCatalogo(rows.length)} />}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-text-subtle">Sin proformas rechazadas por catálogo desactualizado</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.proforma_id} className="text-sm border-b border-border last:border-0 pb-2 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/cotizador/${r.proforma_id}`} className="font-mono text-action-primary hover:underline">{r.numero}</Link>
                <span className="text-text-subtle text-xs whitespace-nowrap">{r.fecha_rechazo}</span>
              </div>
              <p className="text-text-muted truncate">{r.cliente_nombre}{r.motivo_rechazo ? ` — ${r.motivo_rechazo}` : ''}</p>
              {r.dias_desde_actualizacion_precio_max != null && (
                <p className="text-xs text-text-subtle">{r.dias_desde_actualizacion_precio_max} días desde la última actualización de precio</p>
              )}
            </div>
          ))}
        </div>
      )}
    </SeccionColapsable>
  )
}

function TileDeudaViva({ data, facturacionTotal }: { data: DeudaViva; facturacionTotal: number }) {
  const items: RankedBarListItem[] = data.top.map(d => ({
    id: d.proforma_id,
    label: `${d.numero} · ${d.cliente_nombre}`,
    value: d.deuda_cliente_usd,
    valueLabel: formatUSD(d.deuda_cliente_usd),
    href: `/cotizador/${d.proforma_id}`,
  }))
  return (
    <SeccionColapsable
      variante="tile"
      icon={Wallet}
      titulo="Deuda viva"
      headline={formatUSD(data.total_deuda_cliente_usd)}
      indicador={<SemaforoDot nivel={nivelDeuda(data.total_deuda_cliente_usd, facturacionTotal)} />}
    >
      {data.total_deuda_cliente_usd === 0 ? (
        <p className="text-sm text-text-subtle">Sin deuda viva pendiente de cobro</p>
      ) : (
        <div>
          <p className="text-xs text-text-subtle mb-2">
            {data.n_proformas_con_deuda} proforma{data.n_proformas_con_deuda !== 1 ? 's' : ''} con saldo pendiente · deuda a China {formatUSD(data.total_deuda_china_usd)}
          </p>
          <RankedBarList items={items} />
        </div>
      )}
    </SeccionColapsable>
  )
}

function TilePerdidasNotasCredito({ data }: { data: PerdidasNotasCredito }) {
  const total = data.total_perdida_usd + data.total_nota_credito_usd
  const items: RankedBarListItem[] = data.filas.map(f => {
    const motivo = f.motivo_perdida || f.motivo_nota_credito
    return {
      id: f.proforma_id,
      label: `${f.numero} · ${f.cliente_nombre}${motivo ? ` — ${motivo}` : ''}`,
      value: (f.perdida_usd ?? 0) + (f.nota_credito_usd ?? 0),
      valueLabel: [f.perdida_usd ? formatUSD(f.perdida_usd) : null, f.nota_credito_usd ? formatUSD(f.nota_credito_usd) : null].filter(Boolean).join(' + '),
      href: `/cotizador/${f.proforma_id}`,
    }
  })
  return (
    <SeccionColapsable
      variante="tile"
      icon={TrendingDown}
      titulo="Pérdidas y notas de crédito"
      headline={formatUSD(total)}
      indicador={<SemaforoDot nivel={nivelPerdidasNotas(total)} />}
    >
      {total === 0 ? (
        <p className="text-sm text-text-subtle">Sin pérdidas ni notas de crédito registradas</p>
      ) : (
        <div>
          <p className="text-xs text-text-subtle mb-2">
            Pérdidas {formatUSD(data.total_perdida_usd)} · Notas de crédito {formatUSD(data.total_nota_credito_usd)}
          </p>
          <RankedBarList items={items} />
        </div>
      )}
    </SeccionColapsable>
  )
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs>({ recientes: [] })
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<StatsCEO | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [parametros, setParametros] = useState<ParametroPrecio[]>([])
  const [usuario, setUsuario] = useState<Usuario | null>(null)

  // Tab "Estratégico" dentro de la sección colapsable "KPIs" -- solo
  // admin/analista (ver gate en el render de abajo). Carga perezosa: el
  // endpoint solo se pide la primera vez que alguien con acceso toca la
  // pestaña, no en cada carga del dashboard.
  const [tabCEO, setTabCEO] = useState<TabCEO>('operativo')
  const [indicadores, setIndicadores] = useState<IndicadoresEstrategicos | null>(null)
  const [indicadoresLoading, setIndicadoresLoading] = useState(false)
  const [indicadoresError, setIndicadoresError] = useState(false)
  const [indicadoresCargados, setIndicadoresCargados] = useState(false)
  const canVerEstrategico = usuario?.rol === 'admin' || usuario?.rol === 'analista'

  const cargarIndicadores = useCallback(async () => {
    setIndicadoresLoading(true)
    setIndicadoresError(false)
    try {
      const res = await fetch('/api/dashboard/indicadores-estrategicos')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setIndicadores(data as IndicadoresEstrategicos)
    } catch {
      // No bloquea el resto del dashboard: ese ya cargó con sus propios
      // fetch independientes más abajo -- este error solo afecta al tab
      // Estratégico dentro de la sección "KPIs".
      setIndicadoresError(true)
    } finally {
      setIndicadoresLoading(false)
      setIndicadoresCargados(true)
    }
  }, [])

  useEffect(() => {
    if (tabCEO === 'estrategico' && canVerEstrategico && !indicadoresCargados && !indicadoresLoading) {
      cargarIndicadores()
    }
  }, [tabCEO, canVerEstrategico, indicadoresCargados, indicadoresLoading, cargarIndicadores])

  useEffect(() => {
    async function cargarUsuario() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase.from('usuarios').select('*').eq('id', session.user.id).single()
      if (data) setUsuario(data as Usuario)
    }
    cargarUsuario()
  }, [])

  useEffect(() => {
    async function cargar() {
      // Solo para la tabla "Proformas recientes" (las últimas 8) -- los
      // conteos de los tiles de arriba NO salen de acá, ver BUG-008.
      const res = await fetch('/api/proformas?limit=20')
      const { data } = await res.json()
      if (!data) return
      setKpis({ recientes: data.slice(0, 8) })
      setLoading(false)
    }
    cargar()

    fetch('/api/dashboard/stats').then(r => r.json()).then(setStats)
    fetch('/api/clientes').then(r => r.json()).then(({ data }) => setClientes(data || []))
    fetch('/api/parametros-precio').then(r => r.json()).then(({ data }) => setParametros(data || []))
  }, [])

  // BUG-008: los 4 tiles de arriba y el panel "Pipeline general" más abajo
  // mostraban números distintos para el mismo estado (ej. "Enviadas: 0" arriba
  // vs "Enviadas: 95" en Pipeline general). Causa raíz: estos tiles se
  // calculaban contando solo las 20 proformas más recientes (/api/proformas
  // ?limit=20, la misma lista que alimenta "Proformas recientes" abajo), no el
  // total real -- si ninguna de las últimas 20 estaba en un estado dado, el
  // tile mostraba 0 aunque sí hubiera muchas en ese estado históricamente.
  // "Pipeline general" ya usaba /api/dashboard/stats, que cuenta sobre TODA la
  // tabla (ver route.ts: "Conteos por estado (sobre toda la tabla...)"). Ahora
  // ambos bloques leen del mismo stats.pipeline.proformas -- un solo número real.
  const kpiCards = [
    { label: 'Borradores', value: stats?.pipeline.proformas.borrador ?? 0, icon: FileText, color: 'bg-bg-subtle text-text-muted', href: '/proformas?estado=borrador' },
    { label: 'En revisión', value: stats?.pipeline.proformas.en_revision ?? 0, icon: Clock, color: 'bg-warning-bg text-warning', href: '/proformas?estado=en_revision' },
    { label: 'Aprobadas', value: stats?.pipeline.proformas.aprobada ?? 0, icon: CheckCircle, color: 'bg-success-bg text-success', href: '/proformas?estado=aprobada' },
    { label: 'Enviadas', value: stats?.pipeline.proformas.enviada ?? 0, icon: Send, color: 'bg-info-bg text-info', href: '/proformas?estado=enviada' },
  ]
  const kpiCardsLoading = loading || !stats

  // Colapso de 8 colores de estado ad-hoc a los 4 tokens semánticos del
  // sistema de Marta (success/warning/danger/info) + neutral para
  // borrador -- ver Badge.tsx. "facturada" (antes morado) y "anulada"
  // (antes slate) se mapean a info/danger respectivamente, decisión
  // aprobada por Jero (Lote 2, rebrand oct-2026).
  const ESTADO_VARIANT: Record<string, BadgeVariant> = {
    borrador: 'neutral',
    en_revision: 'warning',
    aprobada: 'success',
    rechazada: 'danger',
    enviada: 'info',
    facturada: 'info',
    anulada: 'danger',
  }
  const estadoVariant = (estado: string): BadgeVariant => ESTADO_VARIANT[estado] ?? 'neutral'

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-heading-1 text-text-heading">Dashboard</h1>
        <p className="text-text-muted text-sm mt-1">Resumen de operaciones</p>
      </div>

      {/* KPI Cards -- SIEMPRE visibles, fuera del acordeón */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {kpiCards.map(({ label, value, icon, color, href }) => (
          <StatCard key={label} label={label} value={value} icon={icon} iconClassName={color} href={href} loading={kpiCardsLoading} />
        ))}
      </div>

      {/* Acciones rápidas -- justo después de los 4 KPI tiles, antes del
          acordeón (reordenado a pedido de Jero sobre el diseño de
          ui-ux-designer). SIEMPRE visible. */}
      <div className="flex gap-3 mb-8">
        <Link href="/proformas"
          className="px-5 py-2.5 rounded-lg font-medium text-sm bg-action-primary text-on-action-primary hover:bg-action-primary-hover flex items-center gap-2">
          <FileText size={16} />
          Nueva Proforma
        </Link>
        <Link href="/historial"
          className="px-5 py-2.5 rounded-lg font-medium text-sm border border-border text-text-muted hover:bg-bg-subtle flex items-center gap-2">
          <TrendingUp size={16} />
          Ver Historial de Precios
        </Link>
      </div>

      {/* Alertas genéricas — para no-admin; para admin ya lo cubre la
          sección "Mis Pendientes" del acordeón de abajo. SIEMPRE visible. */}
      {usuario?.rol !== 'admin' && (stats?.pipeline.proformas.en_revision ?? 0) > 0 && (
        <div className="bg-warning-bg border border-warning rounded-xl p-4 mb-8 flex items-center gap-3">
          <AlertCircle size={20} className="text-warning flex-shrink-0" />
          <div>
            <p className="font-medium text-warning">
              {stats!.pipeline.proformas.en_revision} proforma{stats!.pipeline.proformas.en_revision > 1 ? 's' : ''} esperando aprobación
            </p>
            <Link href="/aprobacion" className="text-warning underline text-sm">
              Ir a Aprobaciones →
            </Link>
          </div>
        </div>
      )}

      {/* ── Acordeón: Mis Pendientes / Proformas recientes / KPIs ──
          Cada sección maneja su propio estado abierto/cerrado (nunca
          exclusivo -- abrir "Proformas recientes" no cierra "Mis
          Pendientes"). Estado inicial: Mis Pendientes abierta (admin),
          las otras 2 cerradas. */}
      <div className="space-y-4">
        {/* Mis Pendientes -- lo primero que ve Marta al abrir el acordeón
            (sigue admin-only; MisPendientesPanel ya se auto-oculta si no
            hay pendientes, ver ese archivo). */}
        {usuario?.rol === 'admin' && <MisPendientesPanel />}

        <SeccionColapsable titulo="Proformas recientes" icon={TrendingUp}>
          <div className="flex justify-end mb-2">
            <Link href="/cotizador" className="text-action-primary text-sm font-medium hover:underline">
              Ver todas
            </Link>
          </div>
          <DataTable
            loading={loading}
            emptyMessage="No hay proformas aún"
            rows={kpis.recientes}
            rowKey={p => p.id}
            columns={[
              {
                key: 'numero',
                header: 'Número',
                render: p => (
                  <Link href={`/cotizador/${p.id}`} className="font-mono text-action-primary hover:underline font-medium">
                    {p.numero}
                  </Link>
                ),
              },
              { key: 'cliente', header: 'Cliente', render: p => p.cliente?.nombre },
              { key: 'fecha', header: 'Fecha', render: p => p.fecha },
              {
                key: 'total',
                header: 'Total',
                align: 'right',
                render: p => p.total_cif_usd ? formatUSD(p.total_cif_usd) : p.total_fob_usd ? formatUSD(p.total_fob_usd) : '—',
              },
              {
                key: 'estado',
                header: 'Estado',
                render: p => <Badge variant={estadoVariant(p.estado)}>{p.estado.replace('_', ' ')}</Badge>,
              },
            ]}
          />
        </SeccionColapsable>

        {/* "Panel de la CEO" renombrado a "KPIs" (punto 2 del encargo --
            cambio de título únicamente, el gate de rol y los tabs internos
            Operativo/Estratégico no cambian). */}
        <SeccionColapsable titulo="KPIs">
          {/* Segmented control -- SOLO existe para admin/analista. Para
              operaciones no se renderiza nada (ni deshabilitado, ni oculto
              con CSS): ese rol nunca ve otro contenido que el de abajo. Vive
              dentro del body (no en el header de SeccionColapsable) porque
              son <button> interactivos: anidarlos en el botón que abre/
              cierra la sección sería HTML inválido. */}
          {canVerEstrategico && (
            <div className="flex gap-1 bg-bg-subtle rounded-lg p-1 w-fit mb-4">
              <button
                type="button"
                onClick={() => setTabCEO('operativo')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium min-h-[44px] transition-colors ${
                  tabCEO === 'operativo' ? 'bg-bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
                }`}
              >
                Operativo
              </button>
              <button
                type="button"
                onClick={() => setTabCEO('estrategico')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium min-h-[44px] transition-colors ${
                  tabCEO === 'estrategico' ? 'bg-bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
                }`}
              >
                Estratégico
              </button>
            </div>
          )}

          {/* ── Tab Operativo (default -- lo que ve todo el mundo, sin cambios) ── */}
          {(!canVerEstrategico || tabCEO === 'operativo') && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <StatCard
                  label="Facturación total (enviadas + facturadas)"
                  value={stats ? formatUSD(stats.facturacion_total) : '—'}
                  icon={DollarSign}
                  iconClassName="bg-success-bg text-success"
                />
                <StatCard
                  label={`OTIF ${stats ? `(${stats.otif.a_tiempo}/${stats.otif.total_entregados} despachos a tiempo)` : ''}`}
                  value={stats?.otif.pct != null ? `${(stats.otif.pct * 100).toFixed(0)}%` : '—'}
                  icon={Ship}
                  iconClassName="bg-info-bg text-info"
                />
              </div>

              {/* Tiempos por etapa */}
              <div className="bg-bg-surface rounded-xl shadow-sm border border-border p-5 mb-6">
                <h3 className="font-bold text-text mb-3 flex items-center gap-2">
                  <Clock size={16} className="text-text-heading" /> Tiempo promedio por etapa
                </h3>
                {!stats || stats.tiempos_por_etapa.length === 0 ? (
                  <p className="text-sm text-text-subtle">Aún no hay suficientes datos de transiciones</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {stats.tiempos_por_etapa.map(t => (
                      <div key={t.etapa} className="bg-bg-subtle rounded-lg p-3">
                        <p className="text-xs text-text-muted">{t.etapa}</p>
                        <p className="text-lg font-bold text-text-heading">{fechaLabel(t.promedio_horas)}</p>
                        <p className="text-xs text-text-subtle">{t.muestras} muestra{t.muestras !== 1 ? 's' : ''}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pipeline */}
              <div className="bg-bg-surface rounded-xl shadow-sm border border-border p-5 mb-6">
                <h3 className="font-bold text-text mb-3">Pipeline general</h3>
                <div className="flex flex-wrap gap-3">
                  <Link href="/solicitudes" className="flex items-center gap-2 bg-warning-bg border border-warning rounded-lg px-4 py-2.5 hover:bg-warning-bg">
                    <Inbox size={16} className="text-warning" />
                    <span className="text-sm font-semibold text-warning">{stats?.pipeline.solicitudes_pendientes ?? 0} solicitudes pendientes</span>
                  </Link>
                  {Object.entries(stats?.pipeline.proformas || {}).map(([estado, n]) => (
                    <div key={estado} className="flex items-center gap-2 bg-bg-subtle border border-border rounded-lg px-4 py-2.5">
                      <FileText size={16} className="text-text-subtle" />
                      <span className="text-sm font-medium text-text-muted">{n} {estado.replace('_', ' ')}</span>
                    </div>
                  ))}
                  {Object.entries(stats?.pipeline.despachos || {}).map(([estado, n]) => (
                    <Link key={estado} href="/despachos" className="flex items-center gap-2 bg-info-bg border border-info rounded-lg px-4 py-2.5 hover:bg-info-bg">
                      <Ship size={16} className="text-info" />
                      <span className="text-sm font-medium text-info">{n} {estado.replace('_', ' ')}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Condiciones comerciales -- gateado admin/analista igual que el
                  resto de datos de margen/rentabilidad (antes lo veía cualquier
                  rol). Para operaciones queda exactamente como el resto del
                  tab: sin rastro de que este bloque existe. */}
              {canVerEstrategico && (
                <div className="bg-bg-surface rounded-xl shadow-sm border border-border p-5">
                  <h3 className="font-bold text-text mb-3">Condiciones comerciales</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-semibold text-text-subtle uppercase mb-2">Margen real (calculado del catálogo)</p>
                      <div className="space-y-1.5 mb-3">
                        {(['mayorista', 'detallista'] as const).map(tipo => {
                          const m = stats?.margenes_catalogo[tipo]
                          return (
                            <div key={tipo} className="flex items-center justify-between text-sm">
                              <span className="text-text-muted capitalize">{tipo}</span>
                              <span className="font-medium text-text">
                                {m ? `${m.min.toFixed(1)}% – ${m.max.toFixed(1)}% (prom. ${m.avg.toFixed(1)}%, ${m.n} productos)` : '—'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-xs font-semibold text-text-subtle uppercase mb-2">Clientes por tipo</p>
                      <div className="space-y-1.5">
                        {clientes.map(c => (
                          <div key={c.id} className="flex items-center justify-between text-sm">
                            <span className="text-text-muted">{c.nombre}</span>
                            <span className="text-xs text-text-subtle capitalize">{c.tipo}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text-subtle uppercase mb-2">Parámetros de flete/arancel activos</p>
                      <div className="space-y-1.5">
                        {parametros.length === 0 ? (
                          <p className="text-sm text-text-subtle">Sin parámetros activos</p>
                        ) : parametros.map(p => (
                          <div key={p.id} className="flex items-center justify-between text-sm">
                            <span className="text-text-muted">{p.nombre}</span>
                            <span className="font-medium text-text">{formatUSD(p.flete_usd)} · {(p.arancel_pct * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Tab Estratégico (solo admin/analista) ── */}
          {canVerEstrategico && tabCEO === 'estrategico' && (
            indicadoresLoading ? (
              <SkeletonEstrategico />
            ) : indicadoresError ? (
              <ErrorIndicadores onRetry={cargarIndicadores} />
            ) : indicadores ? (
              <div className="space-y-4">
                <ConcentracionCard clientes={indicadores.concentracion_clientes} paises={indicadores.concentracion_paises} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <TileRentabilidadPorCliente rows={indicadores.rentabilidad_por_cliente} />
                  <TileMargenPorCategoria rows={indicadores.margen_por_categoria} />
                  <TileProformasPerdidas data={indicadores.proformas_perdidas} />
                  <TileCatalogoDesactualizado rows={indicadores.catalogo_desactualizado} />
                  <TileDeudaViva data={indicadores.deuda_viva} facturacionTotal={stats?.facturacion_total ?? 0} />
                  <TilePerdidasNotasCredito data={indicadores.perdidas_notas_credito} />
                </div>
              </div>
            ) : null
          )}
        </SeccionColapsable>
      </div>
    </div>
  )
}
