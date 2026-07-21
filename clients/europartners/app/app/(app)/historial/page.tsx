'use client'
import { useState, useEffect, useRef } from 'react'
import { Search, TrendingUp, TrendingDown, Minus, Tag } from 'lucide-react'
import { formatUSD, formatPct } from '@/lib/precio'

interface Ref {
  codigo_pdf: string
  descripcion_pdf: string
  categoria_id: string | null
  categoria_nombre: string | null
}
interface Fila {
  id: string
  proforma_numero: string
  fecha_proforma: string
  precio_costo_usd: number | null
  precio_cliente_usd: number | null
  margen_pct: number | null
  clientes?: { id: string; nombre: string }
}

const CAT_COLORES: Record<string, string> = {
  'Sanitarios':    'bg-blue-100 text-blue-700 border-blue-200',
  'Wash Basins':   'bg-cyan-100 text-cyan-700 border-cyan-200',
  'Seat Covers':   'bg-purple-100 text-purple-700 border-purple-200',
  'Cabinets':      'bg-amber-100 text-amber-700 border-amber-200',
  'Puertas':       'bg-green-100 text-green-700 border-green-200',
  'Ventanas':      'bg-sky-100 text-sky-700 border-sky-200',
  'Shower Doors':  'bg-teal-100 text-teal-700 border-teal-200',
  'Gypsum':        'bg-gray-100 text-gray-600 border-gray-200',
  'Coolers':       'bg-orange-100 text-orange-700 border-orange-200',
  'Kitchen Sinks': 'bg-rose-100 text-rose-700 border-rose-200',
}

export default function HistorialPage() {
  const [refs, setRefs]                 = useState<Ref[]>([])
  const [filtro, setFiltro]             = useState('')
  const [categoriaFiltro, setCatFiltro] = useState<string | null>(null)
  const [cargandoRefs, setCargandoRefs] = useState(true)

  const [seleccionado, setSeleccionado] = useState<Ref | null>(null)
  const [filas, setFilas]               = useState<Fila[]>([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [clienteId, setClienteId]       = useState('')
  const [clientes, setClientes]         = useState<{ id: string; nombre: string }[]>([])

  const filtroRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/historial?modo=referencias')
      .then(r => r.json())
      .then(({ data }) => { setRefs(data || []); setCargandoRefs(false) })
  }, [])

  useEffect(() => {
    fetch('/api/clientes').then(r => r.json()).then(({ data }) => setClientes(data || []))
  }, [])

  useEffect(() => {
    if (!seleccionado) return
    setCargandoDetalle(true)
    const params = new URLSearchParams({ modo: 'detalle', codigo: seleccionado.codigo_pdf })
    if (clienteId) params.set('cliente_id', clienteId)
    fetch(`/api/historial?${params}`)
      .then(r => r.json())
      .then(({ data }) => { setFilas(data || []); setCargandoDetalle(false) })
  }, [seleccionado, clienteId])

  // Categorías únicas presentes en los datos
  const categorias = Array.from(
    new Map(
      refs
        .filter(r => r.categoria_id && r.categoria_nombre)
        .map(r => [r.categoria_id!, r.categoria_nombre!])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]))

  // Filtrado client-side: categoría + texto
  const refsFiltradas = refs.filter(r => {
    const pasaCat = !categoriaFiltro || r.categoria_id === categoriaFiltro
    if (!pasaCat) return false
    if (!filtro) return true
    const f = filtro.toLowerCase()
    return r.codigo_pdf.toLowerCase().includes(f) || r.descripcion_pdf.toLowerCase().includes(f)
  })

  const stats = filas.length > 1 ? (() => {
    const precios  = filas.map(f => f.precio_cliente_usd).filter(Boolean) as number[]
    const costos   = filas.map(f => f.precio_costo_usd).filter(Boolean) as number[]
    const margenes = filas.map(f => f.margen_pct).filter(Boolean) as number[]
    return {
      precioMin: Math.min(...precios), precioMax: Math.max(...precios),
      costoMin:  Math.min(...costos),  costoMax:  Math.max(...costos),
      margenProm: margenes.reduce((a, b) => a + b, 0) / margenes.length,
    }
  })() : null

  const tendencia = filas.length >= 2 && filas[0].precio_cliente_usd && filas[1].precio_cliente_usd
    ? filas[0].precio_cliente_usd - filas[1].precio_cliente_usd
    : null

  const catColor = seleccionado?.categoria_nombre
    ? CAT_COLORES[seleccionado.categoria_nombre] ?? 'bg-gray-100 text-gray-500 border-gray-200'
    : ''

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">

      {/* ── PANEL IZQUIERDO ── */}
      <aside className="w-72 flex-shrink-0 border-r border-gray-100 bg-white flex flex-col">

        {/* Buscador */}
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={filtroRef}
              type="text"
              placeholder="Código o descripción..."
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
              className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 bg-gray-50"
              autoFocus
            />
          </div>
        </div>

        {/* Selector de categorías */}
        {!cargandoRefs && categorias.length > 0 && (
          <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50/60">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Tag size={10} /> Categoría
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setCatFiltro(null)}
                className={`text-[11px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                  !categoriaFiltro
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                Todas
              </button>
              {categorias.map(([id, nombre]) => (
                <button
                  key={id}
                  onClick={() => {
                    setCatFiltro(prev => prev === id ? null : id)
                    setFiltro('')          // limpiar texto al cambiar categoría
                    setSeleccionado(null)  // limpiar detalle
                  }}
                  className={`text-[11px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                    categoriaFiltro === id
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-[#1E3A5F] hover:text-[#1E3A5F]'
                  }`}
                >
                  {nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Contador */}
        <div className="px-3 py-1.5 border-b border-gray-50">
          <p className="text-[11px] text-gray-400">
            {cargandoRefs
              ? 'Cargando...'
              : `${refsFiltradas.length} referencia${refsFiltradas.length !== 1 ? 's' : ''}${categoriaFiltro ? '' : ''}`
            }
          </p>
        </div>

        {/* Lista de referencias */}
        <div className="flex-1 overflow-y-auto">
          {cargandoRefs ? (
            <div className="p-4 text-xs text-gray-400 text-center">Cargando...</div>
          ) : refsFiltradas.length === 0 ? (
            <div className="p-4 text-xs text-gray-400 text-center">Sin resultados</div>
          ) : (
            refsFiltradas.map(r => (
              <button
                key={r.codigo_pdf}
                onClick={() => { setSeleccionado(r); setClienteId('') }}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-50 transition-colors ${
                  seleccionado?.codigo_pdf === r.codigo_pdf
                    ? 'bg-[#1E3A5F]'
                    : 'hover:bg-gray-50'
                }`}
              >
                <p className={`font-mono text-xs font-semibold ${
                  seleccionado?.codigo_pdf === r.codigo_pdf ? 'text-blue-200' : 'text-[#1E3A5F]'
                }`}>
                  {r.codigo_pdf}
                </p>
                <p className={`text-xs mt-0.5 line-clamp-1 ${
                  seleccionado?.codigo_pdf === r.codigo_pdf ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {r.descripcion_pdf || '—'}
                </p>
                {r.categoria_nombre && seleccionado?.codigo_pdf !== r.codigo_pdf && (
                  <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full border ${
                    CAT_COLORES[r.categoria_nombre] ?? 'bg-gray-100 text-gray-500 border-gray-200'
                  }`}>
                    {r.categoria_nombre}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ── PANEL DERECHO ── */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {!seleccionado ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-3">
            <Search size={44} strokeWidth={1} />
            <p className="text-sm text-gray-400">
              {categoriaFiltro
                ? 'Selecciona una referencia de la categoría'
                : 'Selecciona una referencia en el panel izquierdo'}
            </p>
          </div>
        ) : (
          <div className="p-6">
            {/* Encabezado */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-[#1E3A5F] font-mono">{seleccionado.codigo_pdf}</h2>
                  {seleccionado.categoria_nombre && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${catColor}`}>
                      {seleccionado.categoria_nombre}
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-sm">{seleccionado.descripcion_pdf}</p>
              </div>
              <select
                value={clienteId}
                onChange={e => setClienteId(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
              >
                <option value="">Todos los clientes</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            {cargandoDetalle ? (
              <div className="text-center p-10 text-gray-400 text-sm">Cargando historial...</div>
            ) : filas.length === 0 ? (
              <div className="text-center p-10 text-gray-400 text-sm">Sin registros para esta referencia</div>
            ) : (
              <>
                {/* Stats */}
                {stats && (
                  <div className="grid grid-cols-4 gap-3 mb-5">
                    <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
                      <p className="text-xs text-gray-400 mb-1">Último precio</p>
                      <p className="font-bold text-[#1E3A5F] text-base">
                        {filas[0].precio_cliente_usd ? formatUSD(filas[0].precio_cliente_usd) : '—'}
                      </p>
                      {tendencia !== null && (
                        <p className={`text-xs mt-0.5 flex items-center justify-center gap-0.5 ${
                          tendencia > 0 ? 'text-red-500' : tendencia < 0 ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {tendencia > 0 ? <TrendingUp size={11} /> : tendencia < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                          {tendencia !== 0 ? formatUSD(Math.abs(tendencia)) : 'Sin cambio'}
                        </p>
                      )}
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
                      <p className="text-xs text-gray-400 mb-1">Rango precios</p>
                      <p className="font-semibold text-gray-700 text-sm">
                        {formatUSD(stats.precioMin)} – {formatUSD(stats.precioMax)}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
                      <p className="text-xs text-gray-400 mb-1">Último costo China</p>
                      <p className="font-semibold text-gray-600 text-sm">
                        {filas[0].precio_costo_usd ? formatUSD(filas[0].precio_costo_usd) : '—'}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
                      <p className="text-xs text-gray-400 mb-1">Margen promedio</p>
                      <p className={`font-bold text-sm ${
                        stats.margenProm < 0.08 ? 'text-red-500' :
                        stats.margenProm < 0.12 ? 'text-amber-500' : 'text-green-600'
                      }`}>
                        {formatPct(stats.margenProm)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Tabla */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Fecha</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Proforma</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Cliente</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Costo China</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Precio cliente</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Margen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((f, i) => (
                        <tr key={f.id} className={`border-b border-gray-50 ${i === 0 ? 'bg-blue-50/40' : ''}`}>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {f.fecha_proforma
                              ? new Date(f.fecha_proforma + 'T00:00:00').toLocaleDateString('es-PA', {
                                  day: '2-digit', month: 'short', year: 'numeric'
                                })
                              : '—'}
                            {i === 0 && (
                              <span className="ml-2 text-[10px] bg-blue-100 text-blue-600 font-semibold px-1.5 py-0.5 rounded">
                                último
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-[#1E3A5F]">
                            {f.proforma_numero}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {f.clientes?.nombre || '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-gray-500">
                            {f.precio_costo_usd != null ? formatUSD(f.precio_costo_usd) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[#1E3A5F]">
                            {f.precio_cliente_usd != null ? formatUSD(f.precio_cliente_usd) : '—'}
                          </td>
                          <td className={`px-4 py-3 text-right text-xs font-semibold ${
                            f.margen_pct == null ? 'text-gray-300' :
                            f.margen_pct < 0.08 ? 'text-red-500' :
                            f.margen_pct < 0.12 ? 'text-amber-500' : 'text-green-600'
                          }`}>
                            {f.margen_pct != null ? formatPct(f.margen_pct) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
                    {filas.length} proforma{filas.length !== 1 ? 's' : ''} · más reciente primero
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
