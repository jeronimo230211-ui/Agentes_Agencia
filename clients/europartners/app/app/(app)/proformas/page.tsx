'use client'
import { Suspense, useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  FileText, Clock, CheckCircle, XCircle, Send,
  Receipt, ChevronRight, Plus, Download, AlertCircle, Ban, Loader2,
} from 'lucide-react'
import { formatUSD } from '@/lib/precio'
import { useRol } from '@/lib/useRol'
import FiltroCliente from '@/components/FiltroCliente'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'

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
  const searchParams = useSearchParams()
  const { puedeEditar } = useRol()
  const [clientes, setClientes]     = useState<Cliente[]>([])
  const [proformas, setProformas]   = useState<Proforma[]>([])
  const [loading, setLoading]       = useState(true)
  const [clienteTab, setClienteTab]     = useState<string>('todos')
  const [año, setAño]                   = useState<string>('')
  const [mes, setMes]                   = useState<string>('')
  // Valor inicial desde ?estado= en la URL (lo que llega desde los tiles de
  // pipeline del Dashboard, BUG-001) -- solo si es un estado real, para no
  // dejar el filtro en un valor que la API nunca va a matchear.
  const [estado, setEstado]             = useState<string>(() => {
    const e = searchParams.get('estado')
    return e && e in ESTADO_STYLE ? e : ''
  })
  const [showNueva, setShowNueva]       = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState('')
  const [creando, setCreando]           = useState(false)
  const [exportando, setExportando]     = useState(false)
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [enviandoLote, setEnviandoLote]   = useState(false)
  const [errorLote, setErrorLote]         = useState('')

  // Cargar clientes una vez
  useEffect(() => {
    fetch('/api/clientes')
      .then(r => r.json())
      .then(({ data }) => setClientes(data || []))
  }, [])

  // Cargar proformas cada vez que cambie algún filtro
  const cargarProformas = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '300' })
    if (clienteTab !== 'todos') params.set('cliente_id', clienteTab)
    if (año)    params.set('año', año)
    if (mes)    params.set('mes', mes)
    if (estado) params.set('estado', estado)

    return fetch(`/api/proformas?${params}`)
      .then(r => r.json())
      .then(({ data }) => { setProformas(data || []); setLoading(false) })
  }, [clienteTab, año, mes, estado])

  useEffect(() => { cargarProformas(); setSeleccionadas(new Set()) }, [cargarProformas])

  // KPIs de la vista actual
  const kpis = useMemo(() => {
    const totales = proformas.map(totalProforma).filter((v): v is number => v !== null)
    return {
      count: proformas.length,
      suma: totales.reduce((a, b) => a + b, 0),
      aprobadas: proformas.filter(p => p.estado === 'aprobada' || p.estado === 'enviada').length,
      pendientes: proformas.filter(p => p.estado === 'en_revision').length,
    }
  }, [proformas])

  async function exportarExcel() {
    setExportando(true)
    const params = new URLSearchParams()
    if (clienteTab !== 'todos') params.set('cliente_id', clienteTab)
    if (año)    params.set('año', año)
    if (mes)    params.set('mes', mes)
    if (estado) params.set('estado', estado)

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
  // que POST /api/proformas/[id]/enviar-cliente.
  const proformasEnviables = useMemo(() => proformas.filter(p => p.estado === 'aprobada'), [proformas])
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
            onChange={id => { setClienteTab(id); setMes('') }}
          />
        </div>
      </div>

      {/* ── Filtros secundarios ──
          BUG-009: en mobile este bloque era un solo flex sin wrap ni scroll
          propio -- el ancestro raíz del page (línea ~220) tiene overflow-hidden
          para fijar el layout de la tabla, así que todo lo que no cabía en
          375px quedaba recortado y solo "Todos" (Año) era alcanzable. Ahora
          cada fila (Año, Mes, Estado) es su propia pista de scroll horizontal
          (overflow-x-auto + flex-nowrap), apiladas verticalmente en mobile y
          en una sola fila desde sm: como antes. -mx-4/px-4 extiende el área
          de scroll hasta el borde de la pantalla sin mover el resto del layout. */}
      <div className="px-4 sm:px-8 py-3 bg-bg-surface border-b border-border flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-shrink-0">
        {/* Año */}
        <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
          <span className="text-xs font-semibold text-text-subtle uppercase flex-shrink-0">Año</span>
          <div className="flex gap-1 flex-nowrap flex-shrink-0">
            <button
              onClick={() => { setAño(''); setMes('') }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors flex-shrink-0 ${
                !año ? 'bg-bg-accent text-text-on-accent border-bg-accent' : 'bg-bg-surface text-text-muted border-border hover:border-border-control'
              }`}
            >
              Todos
            </button>
            {['2024', '2025', '2026'].map(y => (
              <button
                key={y}
                onClick={() => { setAño(a => a === y ? '' : y); setMes('') }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors flex-shrink-0 ${
                  año === y ? 'bg-bg-accent text-text-on-accent border-bg-accent' : 'bg-bg-surface text-text-muted border-border hover:border-border-control'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Mes (solo cuando hay año seleccionado) */}
        {año && (
          <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
            <span className="text-xs font-semibold text-text-subtle uppercase flex-shrink-0">Mes</span>
            <div className="flex gap-1 flex-nowrap flex-shrink-0">
              <button
                onClick={() => setMes('')}
                className={`text-xs px-2.5 py-1.5 rounded-full font-medium border transition-colors flex-shrink-0 ${
                  !mes ? 'bg-bg-accent text-text-on-accent border-bg-accent' : 'bg-bg-surface text-text-muted border-border hover:border-border-control'
                }`}
              >
                Todos
              </button>
              {MESES.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setMes(mes === String(i + 1) ? '' : String(i + 1))}
                  className={`text-xs px-2.5 py-1.5 rounded-full font-medium border transition-colors flex-shrink-0 ${
                    mes === String(i + 1) ? 'bg-bg-accent text-text-on-accent border-bg-accent' : 'bg-bg-surface text-text-muted border-border hover:border-border-control'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="hidden sm:block flex-1" />

        {/* Estado */}
        <div className="flex items-center gap-1.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
          {estadosDisponibles.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setEstado(e => e === value ? '' : value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors flex-shrink-0 ${
                estado === value ? 'bg-bg-accent text-text-on-accent border-bg-accent' : 'bg-bg-surface text-text-muted border-border hover:border-border-control'
              }`}
            >
              {label}
            </button>
          ))}
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
        ) : proformas.length === 0 ? (
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
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {proformas.map((p) => {
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
                {proformas.length} proforma{proformas.length !== 1 ? 's' : ''}
                {año ? ` · ${año}${mes ? ` · ${MESES[parseInt(mes) - 1]}` : ''}` : ''}
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
    </div>
  )
}
