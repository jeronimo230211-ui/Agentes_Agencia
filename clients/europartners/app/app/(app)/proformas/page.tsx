'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  FileText, Clock, CheckCircle, XCircle, Send,
  Receipt, ChevronRight, Plus, Download,
} from 'lucide-react'
import { formatUSD } from '@/lib/precio'

interface Cliente { id: string; nombre: string; slug: string; incoterm: string }
interface Proforma {
  id: string
  numero: string
  numero_cliente: string | null
  fecha: string
  fecha_vencimiento: string | null
  incoterm: string
  estado: string
  total_fob_usd: number | null
  total_cif_usd: number | null
  cliente: Cliente | null
  lineas: { count: number }[]
}

const ESTADO_STYLE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  borrador:    { bg: 'bg-gray-100',   text: 'text-gray-600',   icon: <FileText size={12} /> },
  en_revision: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: <Clock size={12} /> },
  aprobada:    { bg: 'bg-green-100',  text: 'text-green-700',  icon: <CheckCircle size={12} /> },
  rechazada:   { bg: 'bg-red-100',    text: 'text-red-600',    icon: <XCircle size={12} /> },
  enviada:     { bg: 'bg-blue-100',   text: 'text-blue-700',   icon: <Send size={12} /> },
  facturada:   { bg: 'bg-purple-100', text: 'text-purple-700', icon: <Receipt size={12} /> },
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

  // Cargar clientes una vez
  useEffect(() => {
    fetch('/api/clientes')
      .then(r => r.json())
      .then(({ data }) => setClientes(data || []))
  }, [])

  // Cargar proformas cada vez que cambie algún filtro
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '300' })
    if (clienteTab !== 'todos') params.set('cliente_id', clienteTab)
    if (año)    params.set('año', año)
    if (mes)    params.set('mes', mes)
    if (estado) params.set('estado', estado)

    fetch(`/api/proformas?${params}`)
      .then(r => r.json())
      .then(({ data }) => { setProformas(data || []); setLoading(false) })
  }, [clienteTab, año, mes, estado])

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

  const estadosDisponibles = [
    { label: 'Todos', value: '' },
    { label: 'Borrador', value: 'borrador' },
    { label: 'En revisión', value: 'en_revision' },
    { label: 'Aprobada', value: 'aprobada' },
    { label: 'Rechazada', value: 'rechazada' },
    { label: 'Enviada', value: 'enviada' },
    { label: 'Facturada', value: 'facturada' },
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
            <button
              onClick={() => setShowNueva(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-white"
              style={{ background: '#D4A017', color: '#1E3A5F' }}
            >
              <Plus size={16} /> Nueva Proforma
            </button>
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

        {/* Tabs de cliente */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          <button
            onClick={() => { setClienteTab('todos'); setMes('') }}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              clienteTab === 'todos'
                ? 'text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={clienteTab === 'todos' ? { background: '#1E3A5F' } : {}}
          >
            Todos los clientes
          </button>
          {clientes.map(c => (
            <button
              key={c.id}
              onClick={() => { setClienteTab(c.id); setMes('') }}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                clienteTab === c.id
                  ? 'text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={clienteTab === c.id ? { background: '#D4A017', color: '#1E3A5F' } : {}}
            >
              {c.nombre}
            </button>
          ))}
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
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                          {st.icon}
                          {p.estado.replace('_', ' ')}
                        </span>
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
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Nueva Proforma</h2>
            <p className="text-sm text-gray-400 mb-4">Selecciona el cliente para comenzar</p>
            <div className="grid grid-cols-1 gap-2 mb-5">
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
                  <span className="text-xs text-gray-400 font-mono">{c.incoterm}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
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
