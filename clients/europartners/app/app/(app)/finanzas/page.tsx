'use client'
import { Suspense, useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Wallet, DollarSign, TrendingUp, AlertTriangle, Ship, ChevronRight, FileText,
  Clock, CheckCircle, XCircle, Send, Receipt, AlertCircle, Ban, X, ArrowRight,
} from 'lucide-react'
import { formatUSD } from '@/lib/precio'
import HistorialPagos from '@/components/HistorialPagos'
import FiltroCliente from '@/components/FiltroCliente'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import StatCard from '@/components/ui/StatCard'
import SearchField from '@/components/ui/SearchField'
import FilterChipRow from '@/components/ui/FilterChipRow'
import { useFiltrosUrl } from '@/lib/useFiltrosUrl'

interface Cliente { id: string; nombre: string; pais: string }

interface DespachoResumen {
  proforma_id: string
  naviera: string | null
  booking_no: string | null
  fecha_llegada_estimada: string | null
  fecha_llegada_real: string | null
  id: string
  shipping_fee_usd: number | null
}

interface FilaFinanzas {
  id: string
  numero: string
  fecha: string
  estado: string
  cliente: { id: string; nombre: string; pais: string } | null
  pais: string | null
  facturado: number
  ganancia: number | null
  deuda_cliente_usd: number
  deuda_china_usd: number | null
  estado_deuda: 'sin_deuda' | 'pendiente' | 'parcial' | 'pagado'
  notas_internas: string | null
  despacho: DespachoResumen | null
  fecha_factura: string | null
}

interface Indicadores {
  facturado: number
  ganancia: number
  deuda_cliente_total: number
  deuda_china_total: number
}

// Colapso de 8 colores ad-hoc a los 4 tokens semánticos (+ neutral) del
// sistema de Marta -- ver Badge.tsx. Mismo criterio que proformas/page.tsx.
const ESTADO_STYLE: Record<string, { variant: BadgeVariant; icon: React.ReactNode }> = {
  borrador:            { variant: 'neutral', icon: <FileText size={12} /> },
  en_revision:         { variant: 'warning', icon: <Clock size={12} /> },
  aprobada:            { variant: 'success', icon: <CheckCircle size={12} /> },
  rechazada:           { variant: 'danger',  icon: <XCircle size={12} /> },
  enviada:             { variant: 'info',    icon: <Send size={12} /> },
  facturada:           { variant: 'info',    icon: <Receipt size={12} /> },
  cambios_solicitados: { variant: 'warning', icon: <AlertCircle size={12} /> },
  anulada:             { variant: 'danger',  icon: <Ban size={12} /> },
  descartada:          { variant: 'neutral', icon: <XCircle size={12} /> },
}

const ESTADO_DEUDA_STYLE: Record<string, { variant: BadgeVariant; label: string }> = {
  sin_deuda: { variant: 'neutral', label: 'Sin deuda' },
  pendiente: { variant: 'danger',  label: 'Pendiente' },
  parcial:   { variant: 'info',    label: 'Parcial' },
  pagado:    { variant: 'success', label: 'Pagado' },
}

const AÑOS_DISPONIBLES = [
  { label: 'Todos', value: '' },
  { label: '2024', value: '2024' },
  { label: '2025', value: '2025' },
  { label: '2026', value: '2026' },
]

const ESTADOS_DEUDA_DISPONIBLES = [
  { label: 'Todos', value: '' },
  { label: 'Sin deuda', value: 'sin_deuda' },
  { label: 'Pendiente', value: 'pendiente' },
  { label: 'Parcial', value: 'parcial' },
  { label: 'Pagado', value: 'pagado' },
]

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fechaCorta(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d} ${MESES[parseInt(m) - 1]} ${y}`
}

// useFiltrosUrl exige un boundary de Suspense en Next 14 -- mismo patrón que
// /proformas (ver app/(app)/proformas/page.tsx).
export default function FinanzasPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-text-subtle text-sm">Cargando...</div>}>
      <FinanzasContent />
    </Suspense>
  )
}

function FinanzasContent() {
  const [clientes, setClientes]   = useState<Cliente[]>([])
  const [filas, setFilas]         = useState<FilaFinanzas[]>([])
  const [indicadores, setIndicadores] = useState<Indicadores | null>(null)
  const [loading, setLoading]     = useState(true)
  const [sinAcceso, setSinAcceso] = useState(false)
  const [filaSeleccionada, setFilaSeleccionada] = useState<FilaFinanzas | null>(null)

  // Todos los filtros de la pantalla sincronizados con la URL para poder
  // compartir un link ya filtrado. `q` (búsqueda) no entra a la query de
  // /api/finanzas -- filtra en memoria sobre lo que ya llegó del servidor,
  // igual que el buscador de /catalogo con los datos ya paginados.
  // `estado_deuda` se valida contra los estados reales de negocio (mismo
  // criterio que /proformas con `estado`, BUG-001): un query param escrito
  // a mano o viejo no debe dejar el filtro en un valor que la API no matchea.
  const { filtros, setFiltro, limpiarFiltros } = useFiltrosUrl(
    { q: '', cliente: 'todos', año: '', pais: '', estado_deuda: '' },
    { estado_deuda: v => v in ESTADO_DEUDA_STYLE }
  )

  useEffect(() => {
    fetch('/api/clientes')
      .then(r => r.json())
      .then(({ data }) => setClientes(data || []))
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtros.cliente !== 'todos') params.set('cliente_id', filtros.cliente)
    if (filtros.año) params.set('año', filtros.año)
    if (filtros.pais) params.set('pais', filtros.pais)
    if (filtros.estado_deuda) params.set('estado_deuda', filtros.estado_deuda)

    fetch(`/api/finanzas?${params}`)
      .then(async r => {
        if (r.status === 403) { setSinAcceso(true); return { data: [], indicadores: null } }
        return r.json()
      })
      .then(({ data, indicadores }) => {
        setFilas(data || [])
        setIndicadores(indicadores || null)
        setLoading(false)
      })
  }, [filtros.cliente, filtros.año, filtros.pais, filtros.estado_deuda])

  const paisesDisponibles = useMemo(
    () => Array.from(new Set(clientes.map(c => c.pais).filter(Boolean))).sort(),
    [clientes]
  )

  // Búsqueda en memoria por número de proforma o nombre de cliente, en AND
  // con los demás filtros (que ya llegan filtrados desde /api/finanzas).
  const filasFiltradas = useMemo(() => {
    const q = filtros.q.trim().toLowerCase()
    if (!q) return filas
    return filas.filter(f =>
      f.numero.toLowerCase().includes(q) ||
      (f.cliente?.nombre ?? '').toLowerCase().includes(q)
    )
  }, [filas, filtros.q])

  const hayFiltrosActivos =
    filtros.q !== '' || filtros.cliente !== 'todos' || filtros.año !== '' ||
    filtros.pais !== '' || filtros.estado_deuda !== ''

  const kpiCards = [
    { label: 'Facturado', value: indicadores?.facturado, icon: DollarSign, color: 'bg-success-bg text-success' },
    { label: 'Ganancia',  value: indicadores?.ganancia,   icon: TrendingUp, color: 'bg-info-bg text-info' },
    { label: 'Deuda de clientes', value: indicadores?.deuda_cliente_total, icon: AlertTriangle, color: 'bg-danger-bg text-danger' },
    { label: 'Deuda con China',   value: indicadores?.deuda_china_total,   icon: Ship,           color: 'bg-info-bg text-info' },
  ]

  if (sinAcceso) {
    return (
      <div className="p-8">
        <div className="bg-bg-surface rounded-xl border border-border p-8 text-center text-text-subtle">
          No tienes acceso a este módulo.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] overflow-hidden">

      {/* ── Encabezado ── */}
      <div className="px-4 sm:px-8 pt-7 pb-4 bg-bg-surface border-b border-border flex-shrink-0">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-text-heading flex items-center gap-2">
            <Wallet size={22} className="text-text-heading" />
            Finanzas
          </h1>
          <p className="text-text-subtle text-sm mt-0.5">Registro maestro — facturación, ganancia y deuda en vivo</p>
        </div>

        {/* Tablero de indicadores -- 2 columnas en mobile (4 columnas fijas
            recortaba los montos en 375px, mismo bug que tenía /proformas) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          {kpiCards.map(({ label, value, icon, color }) => (
            <StatCard
              key={label}
              label={label}
              value={value == null ? '—' : formatUSD(value)}
              icon={icon}
              iconClassName={color}
              loading={loading}
            />
          ))}
        </div>

        {/* Filtro de cliente */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-text-subtle uppercase">Cliente</span>
          <FiltroCliente clientes={clientes} value={filtros.cliente} onChange={v => setFiltro('cliente', v)} />
        </div>

        {/* Buscador -- filtra en memoria por número de proforma o cliente */}
        <SearchField
          value={filtros.q}
          onChange={v => setFiltro('q', v)}
          placeholder="Buscar por número de proforma o cliente..."
          className="max-w-sm"
        />
      </div>

      {/* ── Filtros secundarios ── */}
      <div className="px-4 sm:px-8 py-3 bg-bg-surface border-b border-border flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-shrink-0">
        {/* Año */}
        <FilterChipRow
          label="Año"
          options={AÑOS_DISPONIBLES}
          value={filtros.año}
          onChange={v => setFiltro('año', v)}
        />

        {/* País -- select en vez de chips: no escala bien a medida que crece
            la cantidad de países distintos en los datos (igual al patrón del
            filtro de Cliente en esta misma página). */}
        {paisesDisponibles.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-subtle uppercase flex-shrink-0">País</span>
            <select
              value={filtros.pais}
              onChange={e => setFiltro('pais', e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-2 bg-bg-surface text-text font-medium focus:outline-none focus:ring-2 focus:ring-focus-ring"
            >
              <option value="">Todos los países</option>
              {paisesDisponibles.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}

        <div className="hidden sm:block flex-1" />

        {/* Estado de deuda */}
        <FilterChipRow
          options={ESTADOS_DEUDA_DISPONIBLES}
          value={filtros.estado_deuda}
          onChange={v => setFiltro('estado_deuda', v)}
        />

        {hayFiltrosActivos && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="flex items-center gap-1 text-xs text-text-subtle hover:text-danger flex-shrink-0"
          >
            <X size={13} />
            Limpiar filtros
          </button>
        )}
      </div>

      {/* ── Tabla ── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-text-subtle text-sm">
            Cargando finanzas...
          </div>
        ) : filasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-text-subtle gap-2">
            <FileText size={36} strokeWidth={1} />
            <p className="text-sm">No hay proformas con los filtros seleccionados</p>
          </div>
        ) : (
          <div className="bg-bg-surface rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-subtle border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Proforma</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted">Facturado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted">Ganancia</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted">Deuda cliente</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted">Deuda China</th>
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.map(f => {
                  const st = ESTADO_STYLE[f.estado] ?? ESTADO_STYLE.borrador
                  const dst = ESTADO_DEUDA_STYLE[f.estado_deuda] ?? ESTADO_DEUDA_STYLE.sin_deuda
                  return (
                    <tr
                      key={f.id}
                      className="border-b border-border hover:bg-bg-subtle transition-colors cursor-pointer"
                      onClick={() => setFilaSeleccionada(f)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-text-heading">{f.numero}</span>
                        <span className="block text-xs text-text-subtle">{fechaCorta(f.fecha)}</span>
                      </td>
                      <td className="px-4 py-3 text-text font-medium text-xs">
                        {f.cliente?.nombre ?? '—'}
                        {f.pais && <span className="block text-[11px] text-text-subtle font-normal">{f.pais}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant={st.variant} icon={st.icon}>
                            {f.estado.replace('_', ' ')}
                          </Badge>
                          <Badge variant={dst.variant}>{dst.label}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-text">
                        {f.facturado > 0 ? formatUSD(f.facturado) : <span className="text-text-subtle font-normal">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {f.ganancia != null ? (
                          <span className={f.ganancia >= 0 ? 'text-success' : 'text-danger'}>{formatUSD(f.ganancia)}</span>
                        ) : (
                          <span className="text-text-subtle font-normal">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {f.deuda_cliente_usd > 0 ? (
                          <span className="text-danger">{formatUSD(f.deuda_cliente_usd)}</span>
                        ) : (
                          <span className="text-text-subtle font-normal">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {f.deuda_china_usd != null && f.deuda_china_usd > 0 ? (
                          <span className="text-info">{formatUSD(f.deuda_china_usd)}</span>
                        ) : (
                          <span className="text-text-subtle font-normal">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-subtle">
                        <ChevronRight size={15} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-4 py-2.5 border-t border-border">
              <p className="text-xs text-text-subtle">
                {filasFiltradas.length} proforma{filasFiltradas.length !== 1 ? 's' : ''}
                {filtros.año ? ` · ${filtros.año}` : ''}
                {filtros.pais ? ` · ${filtros.pais}` : ''}
                {filtros.cliente !== 'todos' ? ` · ${clientes.find(c => c.id === filtros.cliente)?.nombre}` : ''}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Drawer de detalle ── */}
      {filaSeleccionada && (
        <DetalleProformaDrawer
          fila={filaSeleccionada}
          onClose={() => setFilaSeleccionada(null)}
        />
      )}
    </div>
  )
}

// ─── Drawer lateral de detalle ──────────────────────────────────────────────
// Solo lectura: muestra el resumen financiero de la fila ya cargada más el
// historial de pagos (mismo endpoint y mismo componente que usa el editor de
// proforma). El registro de pagos en sí sigue viviendo solo en /cotizador/[id].
function DetalleProformaDrawer({
  fila,
  onClose,
}: {
  fila: FilaFinanzas
  onClose: () => void
}) {
  const st = ESTADO_STYLE[fila.estado] ?? ESTADO_STYLE.borrador
  const dst = ESTADO_DEUDA_STYLE[fila.estado_deuda] ?? ESTADO_DEUDA_STYLE.sin_deuda

  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-bg-surface w-full max-w-md h-full shadow-xl flex flex-col">
        <div className="p-5 border-b border-border flex items-start justify-between flex-none">
          <div>
            <p className="font-mono font-bold text-lg text-text-heading">{fila.numero}</p>
            <p className="text-sm text-text-subtle mt-0.5">
              {fila.cliente?.nombre ?? '—'} · {fechaCorta(fila.fecha)}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-bg-subtle rounded-lg flex-none">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant={st.variant} icon={st.icon}>
              {fila.estado.replace('_', ' ')}
            </Badge>
            <Badge variant={dst.variant}>{dst.label}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-bg-subtle rounded-xl p-3 border border-border">
              <p className="text-xs text-text-subtle mb-0.5">Facturado</p>
              <p className="text-base font-bold text-text">
                {fila.facturado > 0 ? formatUSD(fila.facturado) : '—'}
              </p>
            </div>
            <div className="bg-bg-subtle rounded-xl p-3 border border-border">
              <p className="text-xs text-text-subtle mb-0.5">Ganancia</p>
              <p className={`text-base font-bold ${fila.ganancia != null ? (fila.ganancia >= 0 ? 'text-success' : 'text-danger') : 'text-text'}`}>
                {fila.ganancia != null ? formatUSD(fila.ganancia) : '—'}
              </p>
            </div>
            <div className="bg-bg-subtle rounded-xl p-3 border border-border">
              <p className="text-xs text-text-subtle mb-0.5">Deuda cliente</p>
              <p className={`text-base font-bold ${fila.deuda_cliente_usd > 0 ? 'text-danger' : 'text-text'}`}>
                {fila.deuda_cliente_usd > 0 ? formatUSD(fila.deuda_cliente_usd) : '—'}
              </p>
            </div>
            <div className="bg-bg-subtle rounded-xl p-3 border border-border">
              <p className="text-xs text-text-subtle mb-0.5">Deuda China</p>
              <p className={`text-base font-bold ${fila.deuda_china_usd && fila.deuda_china_usd > 0 ? 'text-info' : 'text-text'}`}>
                {fila.deuda_china_usd != null && fila.deuda_china_usd > 0 ? formatUSD(fila.deuda_china_usd) : '—'}
              </p>
            </div>
          </div>

          {/* Fechas de proforma y factura final. Fecha de factura no tiene
              columna dedicada — se deriva en /api/finanzas del evento
              estado_hacia='facturada' en proforma_eventos. */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-text-subtle mb-0.5">Fecha proforma</p>
              <p className="text-text font-medium">{fechaCorta(fila.fecha)}</p>
            </div>
            <div>
              <p className="text-xs text-text-subtle mb-0.5">Fecha factura final</p>
              <p className="text-text font-medium">
                {fila.fecha_factura ? new Date(fila.fecha_factura).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
              </p>
            </div>
          </div>

          {/* Despacho — cruce con `despachos` por proforma_id (naviera, booking,
              ETA y llegada real). Puede no existir todavía. */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Ship size={16} className="text-text-subtle" />
              <h3 className="font-medium text-text text-sm">Despacho</h3>
            </div>
            {fila.despacho ? (
              <div className="grid grid-cols-2 gap-3 text-sm bg-bg-subtle rounded-xl p-3 border border-border">
                <div>
                  <p className="text-xs text-text-subtle mb-0.5">Naviera</p>
                  <p className="text-text font-medium">{fila.despacho.naviera || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-text-subtle mb-0.5">Booking No.</p>
                  <p className="text-text font-medium">{fila.despacho.booking_no || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-text-subtle mb-0.5">ETA</p>
                  <p className="text-text font-medium">{fila.despacho.fecha_llegada_estimada ? fechaCorta(fila.despacho.fecha_llegada_estimada) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-text-subtle mb-0.5">Llegada real</p>
                  <p className="text-text font-medium">{fila.despacho.fecha_llegada_real ? fechaCorta(fila.despacho.fecha_llegada_real) : '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-text-subtle mb-0.5">Shipping fee de referencia</p>
                  <p className="text-text font-medium">{fila.despacho.shipping_fee_usd != null ? formatUSD(fila.despacho.shipping_fee_usd) : 'No cargado'}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-subtle bg-bg-subtle rounded-xl p-3 border border-border">Sin despacho</p>
            )}
          </div>

          {/* Pago de flete — historial real de cobros al cliente por el
              shipping de este despacho (tabla `pagos`, tipo='flete', ver
              migración 024_pago_flete_despacho.sql). Distinto del "Shipping
              fee de referencia" de arriba, que es solo el monto manual que
              carga operaciones. Solo lectura acá — el registro se hace desde
              /despachos (drawer de detalle) o desde el link público del
              cliente. */}
          {fila.despacho && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Wallet size={16} className="text-text-subtle" />
                <h3 className="font-medium text-text text-sm">Pago de flete</h3>
              </div>
              <HistorialPagos
                proformaId={fila.id}
                tipos={['flete']}
                vacioTexto="Todavía no hay pagos de flete registrados para este despacho."
              />
            </div>
          )}

          {/* Observaciones — proformas.notas_internas, mismo campo que se edita
              en cotizador/[id] (no editable acá, /finanzas es solo lectura). */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText size={16} className="text-text-subtle" />
              <h3 className="font-medium text-text text-sm">Observaciones</h3>
            </div>
            <p className="text-sm text-text-muted bg-bg-subtle rounded-xl p-3 border border-border whitespace-pre-wrap">
              {fila.notas_internas || 'Sin observaciones'}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wallet size={16} className="text-text-subtle" />
              <h3 className="font-medium text-text text-sm">Historial de pagos</h3>
            </div>
            <HistorialPagos proformaId={fila.id} />
          </div>
        </div>

        <div className="p-5 border-t border-border flex-none">
          <Link
            href={`/cotizador/${fila.id}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg font-semibold text-sm bg-action-primary text-on-action-primary hover:bg-action-primary-hover"
          >
            Ver proforma completa
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  )
}
