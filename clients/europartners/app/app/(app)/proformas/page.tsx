'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  FileText, Clock, CheckCircle, XCircle, Send,
  Receipt, ChevronRight, Plus, Download, AlertCircle, Ban, Loader2,
} from 'lucide-react'
import { formatUSD } from '@/lib/precio'
import { useRol } from '@/lib/useRol'
import FiltroCliente from '@/components/FiltroCliente'

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

const ESTADO_PAGO_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  parcial: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Abonado' },
  pagado:  { bg: 'bg-green-100', text: 'text-green-700', label: 'Pagado' },
}

const ESTADO_STYLE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  borrador:    { bg: 'bg-gray-100',   text: 'text-gray-600',   icon: <FileText size={12} /> },
  en_revision: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: <Clock size={12} /> },
  aprobada:    { bg: 'bg-green-100',  text: 'text-green-700',  icon: <CheckCircle size={12} /> },
  rechazada:   { bg: 'bg-red-100',    text: 'text-red-600',    icon: <XCircle size={12} /> },
  enviada:     { bg: 'bg-blue-100',   text: 'text-blue-700',   icon: <Send size={12} /> },
  facturada:   { bg: 'bg-purple-100', text: 'text-purple-700', icon: <Receipt size={12} /> },
  cambios_solicitados: { bg: 'bg-amber-100', text: 'text-amber-700', icon: <AlertCircle size={12} /> },
  anulada:     { bg: 'bg-slate-200', text: 'text-slate-600', icon: <Ban size={12} /> },
  descartada:  { bg: 'bg-slate-100', text: 'text-slate-400', icon: <XCircle size={12} /> },
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

export default function ProformasPage() {
  const { puedeEditar } = useRol()
  const [clientes, setClientes]     = useState<Cliente[]>([])
  const [proformas, setProformas]   = useState<Proforma[]>([])
  const [loading, setLoading]       = useState(true)
  const [clienteTab, setClienteTab]     = useState<string>('todos')
  const [año, setAño]                   = useState<string>('')
  const [mes, setMes]                   = useState<string>('')
  const [estado, setEstado]             = useState<string>('')
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
      <div className="px-8 pt-7 pb-4 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-[#1E3A5F]">Proformas</h1>
            <p className="text-gray-400 text-sm mt-0.5">Gestión, historial y creación de cotizaciones</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportarExcel}
              disabled={exportando || proformas.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all"
            >
              <Download size={15} />
              {exportando ? 'Exportando...' : 'Exportar Excel'}
            </button>
            {puedeEditar && (
              <button
                onClick={() => setShowNueva(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-white"
                style={{ background: '#D4A017', color: '#1E3A5F' }}
              >
                <Plus size={16} /> Nueva Proforma
              </button>
            )}
          </div>
        </div>

        {/* KPIs rápidos */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <p className="text-xs text-gray-400 mb-0.5">Total proformas</p>
            <p className="text-xl font-bold text-[#1E3A5F]">{kpis.count}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <p className="text-xs text-gray-400 mb-0.5">Valor total</p>
            <p className="text-xl font-bold text-[#1E3A5F]">
              {kpis.suma > 0 ? formatUSD(kpis.suma) : '—'}
            </p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 border border-green-100">
            <p className="text-xs text-green-600 mb-0.5">Aprobadas / Enviadas</p>
            <p className="text-xl font-bold text-green-700">{kpis.aprobadas}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-100">
            <p className="text-xs text-yellow-600 mb-0.5">Pendientes revisión</p>
            <p className="text-xl font-bold text-yellow-700">{kpis.pendientes}</p>
          </div>
        </div>

        {/* Filtro de cliente */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase">Cliente</span>
          <FiltroCliente
            clientes={clientes}
            value={clienteTab}
            onChange={id => { setClienteTab(id); setMes('') }}
          />
        </div>
      </div>

      {/* ── Filtros secundarios ── */}
      <div className="px-8 py-3 bg-white border-b border-gray-100 flex items-center gap-4 flex-shrink-0">
        {/* Año */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase">Año</span>
          <div className="flex gap-1">
            <button
              onClick={() => { setAño(''); setMes('') }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                !año ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }`}
            >
              Todos
            </button>
            {['2024', '2025', '2026'].map(y => (
              <button
                key={y}
                onClick={() => { setAño(a => a === y ? '' : y); setMes('') }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                  año === y ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Mes (solo cuando hay año seleccionado) */}
        {año && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase">Mes</span>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setMes('')}
                className={`text-xs px-2.5 py-1.5 rounded-full font-medium border transition-colors ${
                  !mes ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                Todos
              </button>
              {MESES.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setMes(mes === String(i + 1) ? '' : String(i + 1))}
                  className={`text-xs px-2.5 py-1.5 rounded-full font-medium border transition-colors ${
                    mes === String(i + 1) ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* Estado */}
        <div className="flex items-center gap-1.5">
          {estadosDisponibles.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setEstado(e => e === value ? '' : value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                estado === value ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Barra de acciones en lote ── */}
      {seleccionadas.size > 0 && (
        <div className="px-8 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between flex-shrink-0">
          <p className="text-sm text-blue-800 font-medium">
            {seleccionadas.size} proforma{seleccionadas.size !== 1 ? 's' : ''} seleccionada{seleccionadas.size !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-3">
            {errorLote && <p className="text-xs text-red-600 max-w-xl">{errorLote}</p>}
            <button
              onClick={enviarSeleccionadas}
              disabled={enviandoLote}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm text-white disabled:opacity-50 transition-opacity"
              style={{ background: '#1E3A5F' }}
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
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            Cargando proformas...
          </div>
        ) : proformas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <FileText size={36} strokeWidth={1} />
            <p className="text-sm">No hay proformas con los filtros seleccionados</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={todasSeleccionadas}
                      disabled={proformasEnviables.length === 0}
                      onChange={toggleTodas}
                      title="Seleccionar todas las proformas aprobadas"
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Proforma</th>
                  {clienteTab === 'todos' && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Cliente</th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Vencimiento</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Refs</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Incoterm</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Total USD</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Estado</th>
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
                      className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors cursor-pointer`}
                      onClick={() => window.location.href = `/cotizador/${p.id}`}
                    >
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={seleccionadas.has(p.id)}
                          disabled={p.estado !== 'aprobada'}
                          onChange={() => toggleSeleccion(p.id)}
                          title={p.estado !== 'aprobada' ? 'Solo se pueden enviar proformas aprobadas' : undefined}
                          className="rounded border-gray-300 disabled:opacity-30"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-[#1E3A5F]">{p.numero}</span>
                        {p.numero_cliente && (
                          <span className="ml-2 text-xs text-gray-400">({p.numero_cliente})</span>
                        )}
                      </td>
                      {clienteTab === 'todos' && (
                        <td className="px-4 py-3 text-gray-700 font-medium text-xs">
                          {p.cliente?.nombre ?? '—'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {fechaCorta(p.fecha)}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {p.fecha_vencimiento ? fechaCorta(p.fecha_vencimiento) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {numLineas}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          p.incoterm === 'CIF' ? 'bg-blue-50 text-blue-600' :
                          p.incoterm === 'CFR' ? 'bg-teal-50 text-teal-600' :
                          'bg-gray-50 text-gray-500'
                        }`}>
                          {p.incoterm}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-800">
                        {total != null ? formatUSD(total) : <span className="text-gray-300 font-normal">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                            {st.icon}
                            {p.estado.replace('_', ' ')}
                          </span>
                          {p.estado_pago && ESTADO_PAGO_STYLE[p.estado_pago] && (
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${ESTADO_PAGO_STYLE[p.estado_pago].bg} ${ESTADO_PAGO_STYLE[p.estado_pago].text}`}>
                              {ESTADO_PAGO_STYLE[p.estado_pago].label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        <ChevronRight size={15} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {proformas.length} proforma{proformas.length !== 1 ? 's' : ''}
                {año ? ` · ${año}${mes ? ` · ${MESES[parseInt(mes) - 1]}` : ''}` : ''}
                {clienteTab !== 'todos' ? ` · ${clientes.find(c => c.id === clienteTab)?.nombre}` : ''}
              </p>
              {kpis.suma > 0 && (
                <p className="text-xs font-semibold text-gray-600">
                  Total vista: <span className="text-[#1E3A5F]">{formatUSD(kpis.suma)}</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal nueva proforma ── */}
      {showNueva && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="p-6 pb-1 flex-none">
              <h2 className="text-lg font-bold text-gray-800 mb-1">Nueva Proforma</h2>
              <p className="text-sm text-gray-400 mb-4">Selecciona el cliente para comenzar</p>
            </div>
            <div className="grid grid-cols-1 gap-2 px-6 overflow-y-auto flex-1">
              {clientes.map(c => (
                <button
                  key={c.id}
                  onClick={() => setNuevoCliente(c.id)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all ${
                    nuevoCliente === c.id
                      ? 'border-[#1E3A5F] bg-[#1E3A5F]/5'
                      : 'border-gray-100 hover:border-gray-300'
                  }`}
                >
                  <span className="font-semibold text-gray-800 text-sm">{c.nombre}</span>
                  <span className="text-xs text-gray-400 font-mono">{c.incoterm_default || 'FOB'}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3 p-6 pt-5 flex-none border-t border-gray-100">
              <button
                onClick={crearProforma}
                disabled={!nuevoCliente || creando}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-40 transition-opacity"
                style={{ background: '#1E3A5F' }}
              >
                {creando ? 'Creando...' : 'Crear proforma →'}
              </button>
              <button
                onClick={() => { setShowNueva(false); setNuevoCliente('') }}
                className="px-4 py-2.5 rounded-xl border text-sm text-gray-500 hover:bg-gray-50"
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
