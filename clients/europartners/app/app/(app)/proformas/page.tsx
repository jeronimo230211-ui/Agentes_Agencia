'use client'
import { Suspense, useState, useEffect, useMemo, useCallback } from 'react'
import {
  FileText, Clock, CheckCircle, XCircle, Send,
  Receipt, ChevronRight, Plus, Download, AlertCircle, Ban, Loader2, X, RotateCcw,
} from 'lucide-react'
import { formatUSD } from '@/lib/precio'
import { useRol } from '@/lib/useRol'
import { useFiltrosUrl } from '@/lib/useFiltrosUrl'
import FiltroCliente from '@/components/FiltroCliente'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import SearchField from '@/components/ui/SearchField'
import FilterChipRow from '@/components/ui/FilterChipRow'

interface Cliente { id: string; nombre: string; slug: string; incoterm_default: string | null }
interface Proforma {
  id: string
  numero: string
  numero_cliente: string | null
  fecha: string
  fecha_vencimiento: string | null
  incoterm: string
  estado: string
  estado_pago?: string
  total_fob_usd: number | null
  total_cif_usd: number | null
  cliente: Cliente | null
  lineas: { count: number }[]
}

const ESTADO_PAGO_STYLE: Record<string, { variant: BadgeVariant; label: string }> = {
  parcial: { variant: 'info', label: 'Abonado' },
  pagado:  { variant: 'success', label: 'Pagado' },
}

// Colapso de 8 colores ad-hoc a los 4 tokens semánticos (+ neutral) del
// sistema de Marta -- ver Badge.tsx. "facturada" (antes morado) se mapea a
// info, "cambios_solicitados" (antes ámbar) a warning, "anulada" (antes
// slate) a danger (es una cancelación) y "descartada" (antes slate claro)
// a neutral -- decisión aprobada por Jero (Lote 2, rebrand oct-2026).
const ESTADO_STYLE: Record<string, { variant: BadgeVariant; icon: React.ReactNode }> = {
  borrador:    { variant: 'neutral', icon: <FileText size={12} /> },
  en_revision: { variant: 'warning', icon: <Clock size={12} /> },
  aprobada:    { variant: 'success', icon: <CheckCircle size={12} /> },
  rechazada:   { variant: 'danger',  icon: <XCircle size={12} /> },
  enviada:     { variant: 'info',    icon: <Send size={12} /> },
  facturada:   { variant: 'info',    icon: <Receipt size={12} /> },
  cambios_solicitados: { variant: 'warning', icon: <AlertCircle size={12} /> },
  anulada:     { variant: 'danger',  icon: <Ban size={12} /> },
  descartada:  { variant: 'neutral', icon: <XCircle size={12} /> },
}

const MESES = [
  'Ene','Feb','Mar','Abr','May','Jun',
  'Jul','Ago','Sep','Oct','Nov','Dic',
]

function fechaCorta(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d} ${MESES[parseInt(m) - 1]} ${y}`
}

function totalProforma(p: Proforma) {
  return p.total_cif_usd ?? p.total_fob_usd ?? null
}

// 'facturada' se anula desde /facturador (admin-only, es cancelar una
// factura ya emitida) y 'anulada' ya está anulada -- para esos dos estados
// esta pantalla no muestra el botón "Anular" ('anulada' en cambio muestra
// "Reactivar", ver más abajo).
function puedeAnularseAqui(estado: string) {
  return estado !== 'facturada' && estado !== 'anulada'
}

// useSearchParams exige un boundary de Suspense en Next 14 -- mismo patrón
// que /login (ver app/(auth)/login/page.tsx).
export default function ProformasPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-text-subtle text-sm">Cargando...</div>}>
      <ProformasContent />
    </Suspense>
  )
}

function ProformasContent() {
  const { puedeEditar } = useRol()
  const [clientes, setClientes]     = useState<Cliente[]>([])
  const [proformas, setProformas]   = useState<Proforma[]>([])
  const [loading, setLoading]       = useState(true)
  const [clienteTab, setClienteTab]     = useState<string>('todos')
  // q/año/mes/estado viven en la URL (useFiltrosUrl) para que un link
  // filtrado sea compartible, ej. ?q=0126&estado=enviada&anio=2026. El
  // validador de `estado` reemplaza el chequeo manual que antes hacía este
  // componente contra ?estado= al montar (BUG-001, viene de los tiles de
  // pipeline del Dashboard) -- mismo criterio: solo acepta un estado real
  // del catálogo, para no dejar el filtro en un valor que la API nunca va
  // a matchear.
  const { filtros, setFiltro, setFiltros, limpiarFiltros } = useFiltrosUrl(
    { q: '', anio: '', mes: '', estado: '' },
    { estado: (valor) => valor in ESTADO_STYLE }
  )
  const [showNueva, setShowNueva]       = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState('')
  const [creando, setCreando]           = useState(false)
  const [exportando, setExportando]     = useState(false)
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [enviandoLote, setEnviandoLote]   = useState(false)
  const [errorLote, setErrorLote]         = useState('')
  // Anular desde cualquier estado -- antes la única anulación vivía en
  // /facturador y solo aplicaba a 'facturada'. Deisy pidió poder anularla
  // acá mismo sin pasar por Facturador (ESTADO_PUEDE_ANULARSE más abajo).
  const [anulando, setAnulando] = useState<Proforma | null>(null)
  // Reactivar ("desanular") una proforma anulada por error, para reutilizar
  // su número -- ver POST /api/proformas/[id]/desanular.
  const [desanulando, setDesanulando] = useState<Proforma | null>(null)

  // Cargar clientes una vez
  useEffect(() => {
    fetch('/api/clientes')
      .then(r => r.json())
      .then(({ data }) => setClientes(data || []))
  }, [])

  // Cargar proformas cada vez que cambie algún filtro que pega contra la
  // API (cliente, año, mes, estado). La búsqueda (q) NO dispara esta
  // llamada -- filtra en memoria sobre lo que ya está cargado (ver
  // proformasVisibles).
  const cargarProformas = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '300' })
    if (clienteTab !== 'todos') params.set('cliente_id', clienteTab)
    if (filtros.anio)   params.set('año', filtros.anio)
    if (filtros.mes)    params.set('mes', filtros.mes)
    if (filtros.estado) params.set('estado', filtros.estado)

    return fetch(`/api/proformas?${params}`)
      .then(r => r.json())
      .then(({ data }) => { setProformas(data || []); setLoading(false) })
  }, [clienteTab, filtros.anio, filtros.mes, filtros.estado])

  useEffect(() => { cargarProformas(); setSeleccionadas(new Set()) }, [cargarProformas])

  // Búsqueda por número de proforma, número de cliente o nombre del
  // cliente -- en memoria, AND con los demás filtros (que ya recortaron
  // `proformas` vía la API).
  const proformasVisibles = useMemo(() => {
    const q = filtros.q.trim().toLowerCase()
    if (!q) return proformas
    return proformas.filter(p =>
      p.numero.toLowerCase().includes(q) ||
      (p.numero_cliente ?? '').toLowerCase().includes(q) ||
      (p.cliente?.nombre ?? '').toLowerCase().includes(q)
    )
  }, [proformas, filtros.q])

  // KPIs de la vista actual
  const kpis = useMemo(() => {
    const totales = proformasVisibles.map(totalProforma).filter((v): v is number => v !== null)
    return {
      count: proformasVisibles.length,
      suma: totales.reduce((a, b) => a + b, 0),
      aprobadas: proformasVisibles.filter(p => p.estado === 'aprobada' || p.estado === 'enviada').length,
      pendientes: proformasVisibles.filter(p => p.estado === 'en_revision').length,
    }
  }, [proformasVisibles])

  async function exportarExcel() {
    setExportando(true)
    const params = new URLSearchParams()
    if (clienteTab !== 'todos') params.set('cliente_id', clienteTab)
    if (filtros.anio)   params.set('año', filtros.anio)
    if (filtros.mes)    params.set('mes', filtros.mes)
    if (filtros.estado) params.set('estado', filtros.estado)

    const res = await fetch(`/api/proformas/export?${params}`)
    if (!res.ok) { setExportando(false); return }

    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') ?? 'proformas.xlsx'
    a.click()
    URL.revokeObjectURL(url)
    setExportando(false)
  }

  async function crearProforma() {
    if (!nuevoCliente) return
    setCreando(true)
    const res = await fetch('/api/proformas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id: nuevoCliente }),
    })
    const { data } = await res.json()
    if (data) window.location.href = `/cotizador/${data.id}`
    setCreando(false)
  }

  // Solo se pueden seleccionar/enviar proformas 'aprobada' — mismo requisito
  // que POST /api/proformas/[id]/enviar-cliente. Restringido a las visibles
  // (post-búsqueda) para que "seleccionar todas" no incluya filas ocultas.
  const proformasEnviables = useMemo(() => proformasVisibles.filter(p => p.estado === 'aprobada'), [proformasVisibles])
  const todasSeleccionadas = proformasEnviables.length > 0 && proformasEnviables.every(p => seleccionadas.has(p.id))

  function toggleSeleccion(id: string) {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTodas() {
    setSeleccionadas(todasSeleccionadas ? new Set() : new Set(proformasEnviables.map(p => p.id)))
  }

  async function enviarSeleccionadas() {
    if (seleccionadas.size === 0) return
    setEnviandoLote(true)
    setErrorLote('')
    const res = await fetch('/api/proformas/enviar-multiples', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(seleccionadas) }),
    })
    const j = await res.json()
    if (!res.ok) {
      setErrorLote(j.error || 'Error al enviar las proformas seleccionadas')
    } else if (j.errores?.length) {
      setErrorLote(`Se enviaron ${j.enviadas?.length ?? 0}, fallaron: ${j.errores.map((e: { numero?: string; error: string }) => `${e.numero || ''} (${e.error})`).join(', ')}`)
    }
    await cargarProformas()
    setSeleccionadas(new Set())
    setEnviandoLote(false)
  }

  const anioOptions = [
    { label: 'Todos', value: '' },
    { label: '2024', value: '2024' },
    { label: '2025', value: '2025' },
    { label: '2026', value: '2026' },
  ]

  const mesOptions = [
    { label: 'Todos', value: '' },
    ...MESES.map((m, i) => ({ label: m, value: String(i + 1) })),
  ]

  const estadosDisponibles = [
    { label: 'Todos', value: '' },
    { label: 'Borrador', value: 'borrador' },
    { label: 'En revisión', value: 'en_revision' },
    { label: 'Aprobada', value: 'aprobada' },
    { label: 'Rechazada', value: 'rechazada' },
    { label: 'Enviada', value: 'enviada' },
    { label: 'Cambios solicitados', value: 'cambios_solicitados' },
    { label: 'Facturada', value: 'facturada' },
    { label: 'Anulada', value: 'anulada' },
    { label: 'Descartada', value: 'descartada' },
  ]

  // Controla el botón "Limpiar filtros" -- solo cuenta los filtros que vive
  // en la URL (búsqueda, año, mes, estado); el filtro de Cliente tiene su
  // propio tab "Todos" en FiltroCliente.
  const hayFiltrosActivos = Boolean(filtros.q || filtros.anio || filtros.mes || filtros.estado)

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] overflow-hidden">

      {/* ── Encabezado ── */}
      <div className="px-8 pt-7 pb-4 bg-bg-surface border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-text-heading">Proformas</h1>
            <p className="text-text-subtle text-sm mt-0.5">Gestión, historial y creación de cotizaciones</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportarExcel}
              disabled={exportando || proformas.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm border border-border bg-bg-surface text-text-muted hover:bg-bg-subtle disabled:opacity-40 transition-all"
            >
              <Download size={15} />
              {exportando ? 'Exportando...' : 'Exportar Excel'}
            </button>
            {puedeEditar && (
              <button
                onClick={() => setShowNueva(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm bg-action-primary text-on-action-primary hover:bg-action-primary-hover"
              >
                <Plus size={16} /> Nueva Proforma
              </button>
            )}
          </div>
        </div>

        {/* KPIs rápidos -- BUG-009: 4 columnas fijas en 375px dejaban muy poco
            ancho por tile y el monto de "Valor total" (ej. "$2,520,500.00")
            se recortaba. 2 columnas en mobile, 4 desde sm:, y el valor en
            text-lg (en vez de text-xl) solo en mobile le da aire. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-bg-subtle rounded-xl p-3 border border-border">
            <p className="text-xs text-text-subtle mb-0.5">Total proformas</p>
            <p className="text-lg sm:text-xl font-bold text-text-heading">{kpis.count}</p>
          </div>
          <div className="bg-bg-subtle rounded-xl p-3 border border-border">
            <p className="text-xs text-text-subtle mb-0.5">Valor total</p>
            <p className="text-lg sm:text-xl font-bold text-text-heading">
              {kpis.suma > 0 ? formatUSD(kpis.suma) : '—'}
            </p>
          </div>
          <div className="bg-success-bg rounded-xl p-3 border border-success">
            <p className="text-xs text-success mb-0.5">Aprobadas / Enviadas</p>
            <p className="text-lg sm:text-xl font-bold text-success">{kpis.aprobadas}</p>
          </div>
          <div className="bg-warning-bg rounded-xl p-3 border border-warning">
            <p className="text-xs text-warning mb-0.5">Pendientes revisión</p>
            <p className="text-lg sm:text-xl font-bold text-warning">{kpis.pendientes}</p>
          </div>
        </div>

        {/* Filtro de cliente */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-subtle uppercase">Cliente</span>
          <FiltroCliente
            clientes={clientes}
            value={clienteTab}
            onChange={id => { setClienteTab(id); setFiltro('mes', '') }}
          />
        </div>
      </div>

      {/* ── Filtros secundarios ──
          BUG-009: en mobile este bloque era un solo flex sin wrap ni scroll
          propio -- el ancestro raíz del page (línea ~220) tiene overflow-hidden
          para fijar el layout de la tabla, así que todo lo que no cabía en
          375px quedaba recortado y solo "Todos" (Año) era alcanzable. Ahora
          cada fila de chips usa FilterChipRow, que ya resuelve ese scroll
          seguro por su cuenta (ver components/ui/FilterChipRow.tsx). */}
      <div className="px-4 sm:px-8 py-3 bg-bg-surface border-b border-border flex-shrink-0">
        {/* Búsqueda -- en memoria sobre lo ya cargado, AND con el resto de
            los filtros (Cliente, Año, Mes, Estado). */}
        <div className="mb-3">
          <SearchField
            value={filtros.q}
            onChange={v => setFiltro('q', v)}
            placeholder="Buscar por número de proforma, número de cliente o nombre..."
            className="max-w-md"
          />
        </div>

        {/* BUG-010: sin flex-wrap en sm:, cuando Estado (9 opciones) ya pasaba
            a 2 líneas por su propio flex-wrap interno, el flex-1 del spacer
            colapsaba a 0 y Estado quedaba centrado verticalmente justo encima
            de la fila de Mes -- overlap de texto en laptops 1280-1366px. Con
            flex-wrap el contenedor también reacomoda sus hijos a una segunda
            línea en vez de superponerlos. */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4">
          {/* Año */}
          <FilterChipRow
            label="Año"
            options={anioOptions}
            value={filtros.anio}
            onChange={v => setFiltros(prev => ({ ...prev, anio: v, mes: '' }))}
          />

          {/* Mes (solo cuando hay año seleccionado) */}
          {filtros.anio && (
            <FilterChipRow
              label="Mes"
              options={mesOptions}
              value={filtros.mes}
              onChange={v => setFiltro('mes', v)}
            />
          )}

          <div className="hidden sm:block flex-1" />

          {/* Estado */}
          <FilterChipRow
            options={estadosDisponibles}
            value={filtros.estado}
            onChange={v => setFiltro('estado', v)}
          />

          {/* Limpiar filtros -- solo si hay algo que limpiar */}
          {hayFiltrosActivos && (
            <button
              onClick={limpiarFiltros}
              className="flex items-center gap-1 text-xs text-text-subtle hover:text-danger flex-shrink-0"
            >
              <X size={12} /> Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* ── Barra de acciones en lote ── */}
      {seleccionadas.size > 0 && (
        <div className="px-8 py-2.5 bg-info-bg border-b border-info flex items-center justify-between flex-shrink-0">
          <p className="text-sm text-info font-medium">
            {seleccionadas.size} proforma{seleccionadas.size !== 1 ? 's' : ''} seleccionada{seleccionadas.size !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-3">
            {errorLote && <p className="text-xs text-danger max-w-xl">{errorLote}</p>}
            <button
              onClick={enviarSeleccionadas}
              disabled={enviandoLote}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm bg-bg-brand text-text-on-brand disabled:opacity-50 transition-opacity"
            >
              {enviandoLote ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {enviandoLote ? 'Enviando...' : 'Enviar seleccionadas'}
            </button>
          </div>
        </div>
      )}

      {/* ── Tabla ── */}
      <div className="flex-1 overflow-y-auto px-8 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-text-subtle text-sm">
            Cargando proformas...
          </div>
        ) : proformasVisibles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-text-subtle gap-2">
            <FileText size={36} strokeWidth={1} />
            <p className="text-sm">No hay proformas con los filtros seleccionados</p>
          </div>
        ) : (
          <div className="bg-bg-surface rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-subtle border-b border-border">
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={todasSeleccionadas}
                      disabled={proformasEnviables.length === 0}
                      onChange={toggleTodas}
                      title="Seleccionar todas las proformas aprobadas"
                      className="rounded border-border-strong"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Proforma</th>
                  {clienteTab === 'todos' && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Cliente</th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Vencimiento</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-text-muted">Refs</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Incoterm</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted">Total USD</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Estado</th>
                  <th className="w-20 px-4 py-3" />
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {proformasVisibles.map((p) => {
                  const st = ESTADO_STYLE[p.estado] ?? ESTADO_STYLE.borrador
                  const total = totalProforma(p)
                  const numLineas = p.lineas?.[0]?.count ?? 0
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-border hover:bg-bg-subtle transition-colors cursor-pointer`}
                      onClick={() => window.location.href = `/cotizador/${p.id}`}
                    >
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={seleccionadas.has(p.id)}
                          disabled={p.estado !== 'aprobada'}
                          onChange={() => toggleSeleccion(p.id)}
                          title={p.estado !== 'aprobada' ? 'Solo se pueden enviar proformas aprobadas' : undefined}
                          className="rounded border-border-strong disabled:opacity-30"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-text-heading">{p.numero}</span>
                        {p.numero_cliente && (
                          <span className="ml-2 text-xs text-text-subtle">({p.numero_cliente})</span>
                        )}
                      </td>
                      {clienteTab === 'todos' && (
                        <td className="px-4 py-3 text-text font-medium text-xs">
                          {p.cliente?.nombre ?? '—'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                        {fechaCorta(p.fecha)}
                      </td>
                      <td className="px-4 py-3 text-text-subtle text-xs whitespace-nowrap">
                        {p.fecha_vencimiento ? fechaCorta(p.fecha_vencimiento) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-semibold text-text-muted bg-bg-subtle px-2 py-0.5 rounded-full">
                          {numLineas}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          p.incoterm === 'CIF' ? 'bg-info-bg text-info' :
                          p.incoterm === 'CFR' ? 'bg-info-bg text-info' :
                          'bg-bg-subtle text-text-muted'
                        }`}>
                          {p.incoterm}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-text">
                        {total != null ? formatUSD(total) : <span className="text-text-subtle font-normal">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant={st.variant} icon={st.icon}>
                            {p.estado.replace('_', ' ')}
                          </Badge>
                          {p.estado_pago && ESTADO_PAGO_STYLE[p.estado_pago] && (
                            <Badge variant={ESTADO_PAGO_STYLE[p.estado_pago].variant}>
                              {ESTADO_PAGO_STYLE[p.estado_pago].label}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {/* BUG-003: sin padding el área táctil era solo el alto del
                            texto (~16px), muy por debajo del mínimo de 44px. El padding
                            extra hace crecer la fila cuando hace falta -- aceptable, no
                            rompe el layout en desktop ni el scroll horizontal en mobile. */}
                        {puedeEditar && puedeAnularseAqui(p.estado) && (
                          <button
                            onClick={() => setAnulando(p)}
                            className="flex items-center gap-1 text-xs font-semibold text-danger hover:opacity-80 px-2.5 py-3 -mx-2.5 rounded-lg hover:bg-danger/10"
                          >
                            <Ban size={13} /> Anular
                          </button>
                        )}
                        {puedeEditar && p.estado === 'anulada' && (
                          <button
                            onClick={() => setDesanulando(p)}
                            className="flex items-center gap-1 text-xs font-semibold text-action-primary hover:opacity-80 px-2.5 py-3 -mx-2.5 rounded-lg hover:bg-action-primary/10"
                          >
                            <RotateCcw size={13} /> Reactivar
                          </button>
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
            <div className="px-4 py-2.5 border-t border-border flex items-center justify-between">
              <p className="text-xs text-text-subtle">
                {proformasVisibles.length} proforma{proformasVisibles.length !== 1 ? 's' : ''}
                {filtros.anio ? ` · ${filtros.anio}${filtros.mes ? ` · ${MESES[parseInt(filtros.mes) - 1]}` : ''}` : ''}
                {clienteTab !== 'todos' ? ` · ${clientes.find(c => c.id === clienteTab)?.nombre}` : ''}
              </p>
              {kpis.suma > 0 && (
                <p className="text-xs font-semibold text-text-muted">
                  Total vista: <span className="text-text-heading">{formatUSD(kpis.suma)}</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal nueva proforma ── */}
      {showNueva && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="p-6 pb-1 flex-none">
              <h2 className="text-lg font-bold text-text mb-1">Nueva Proforma</h2>
              <p className="text-sm text-text-subtle mb-4">Selecciona el cliente para comenzar</p>
            </div>
            <div className="grid grid-cols-1 gap-2 px-6 overflow-y-auto flex-1">
              {clientes.map(c => (
                <button
                  key={c.id}
                  onClick={() => setNuevoCliente(c.id)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all ${
                    nuevoCliente === c.id
                      ? 'border-action-primary bg-bg-selected'
                      : 'border-border hover:border-border-strong'
                  }`}
                >
                  <span className="font-semibold text-text text-sm">{c.nombre}</span>
                  <span className="text-xs text-text-subtle font-mono">{c.incoterm_default || 'FOB'}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3 p-6 pt-5 flex-none border-t border-border">
              <button
                onClick={crearProforma}
                disabled={!nuevoCliente || creando}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-action-primary text-on-action-primary hover:bg-action-primary-hover disabled:opacity-40 transition-opacity"
              >
                {creando ? 'Creando...' : 'Crear proforma →'}
              </button>
              <button
                onClick={() => { setShowNueva(false); setNuevoCliente('') }}
                className="px-4 py-2.5 rounded-xl border text-sm text-text-muted hover:bg-bg-subtle"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal anular proforma ── */}
      {anulando && (
        <ModalAnularProforma
          proforma={anulando}
          onClose={() => setAnulando(null)}
          onAnulada={() => { setAnulando(null); cargarProformas() }}
        />
      )}

      {/* ── Modal reactivar proforma anulada ── */}
      {desanulando && (
        <ModalDesanularProforma
          proforma={desanulando}
          onClose={() => setDesanulando(null)}
          onReactivada={() => { setDesanulando(null); cargarProformas() }}
        />
      )}
    </div>
  )
}

// Mismo patrón que ModalAnular de /facturador (motivo obligatorio, mensaje
// de advertencia, llamada a POST /api/proformas/[id]/anular) -- se adapta
// acá en vez de reusarse directamente porque esta pantalla puede anular
// desde cualquier estado, no solo 'facturada', y el texto de advertencia
// cambia según eso.
function ModalAnularProforma({
  proforma, onClose, onAnulada,
}: {
  proforma: Proforma
  onClose: () => void
  onAnulada: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function confirmar() {
    if (!motivo.trim()) { setError('El motivo es obligatorio'); return }
    setEnviando(true)
    setError('')
    const res = await fetch(`/api/proformas/${proforma.id}/anular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo }),
    })
    const json = await res.json()
    setEnviando(false)
    if (!res.ok) { setError(json.error || 'Error al anular'); return }
    onAnulada()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-text">Anular proforma</h2>
            <p className="text-xs text-text-subtle">{proforma.numero} · {proforma.cliente?.nombre}</p>
          </div>
          <button onClick={onClose} className="text-text-subtle hover:text-text-muted"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-text-muted">
            Una proforma anulada no se puede editar ni avanzar en el flujo normal —
            si fue un error o ya no aplica, se puede reactivar después con el botón &quot;Reactivar&quot;.
            Explica el motivo para dejarlo registrado.
          </p>
          <textarea
            autoFocus
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ej.: cliente canceló el pedido, error en los datos..."
            className="bg-bg-surface w-full border border-border rounded-lg p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-danger"
          />
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
        <div className="flex gap-3 p-5 pt-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-border text-text-muted hover:bg-bg-subtle"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={enviando}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm text-on-danger bg-danger hover:opacity-90 disabled:opacity-50"
          >
            {enviando && <Loader2 size={14} className="animate-spin" />}
            Anular proforma
          </button>
        </div>
      </div>
    </div>
  )
}

// Reactiva una proforma anulada (vuelve a 'borrador') para reutilizar su
// número -- mismo patrón que ModalAnularProforma de arriba (motivo
// obligatorio, llamada a POST /api/proformas/[id]/desanular que valida
// rol+estado otra vez en el servidor).
function ModalDesanularProforma({
  proforma, onClose, onReactivada,
}: {
  proforma: Proforma
  onClose: () => void
  onReactivada: () => void
}) {
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function confirmar() {
    if (!comentario.trim()) { setError('El motivo es obligatorio'); return }
    setEnviando(true)
    setError('')
    const res = await fetch(`/api/proformas/${proforma.id}/desanular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comentario }),
    })
    const json = await res.json()
    setEnviando(false)
    if (!res.ok) { setError(json.error || 'Error al reactivar'); return }
    onReactivada()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-text">Reactivar proforma</h2>
            <p className="text-xs text-text-subtle">{proforma.numero} · {proforma.cliente?.nombre}</p>
          </div>
          <button onClick={onClose} className="text-text-subtle hover:text-text-muted"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-text-muted">
            La proforma vuelve a &quot;borrador&quot; y se puede editar normalmente (cambiar cliente,
            líneas, etc.). Explica el motivo de la reactivación para dejarlo registrado.
          </p>
          <textarea
            autoFocus
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            placeholder="Ej.: se anuló por error, se reutiliza para otro pedido..."
            className="bg-bg-surface w-full border border-border rounded-lg p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-focus-ring"
          />
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
        <div className="flex gap-3 p-5 pt-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-border text-text-muted hover:bg-bg-subtle"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={enviando}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm text-on-action-primary bg-action-primary hover:bg-action-primary-hover disabled:opacity-50"
          >
            {enviando && <Loader2 size={14} className="animate-spin" />}
            Reactivar proforma
          </button>
        </div>
      </div>
    </div>
  )
}
