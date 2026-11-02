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
  codigo_pdf: string
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
    if (!seleccionado && !clienteId) { setFilas([]); return }
    setCargandoDetalle(true)
    const params = new URLSearchParams({ modo: 'detalle' })
    if (seleccionado) params.set('codigo', seleccionado.codigo_pdf)
    if (clienteId) params.set('cliente_id', clienteId)
    fetch(`/api/historial?${params}`)
      .then(r => r.json())
      .then(({ data }) => { setFilas(data || []); setCargandoDetalle(false) })
  }, [seleccionado, clienteId])

  const clienteSeleccionado = clientes.find(c => c.id === clienteId) || null

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
      {/* BUG-007: era bg-white fijo -- en modo oscuro el texto del SKU
          (text-text-heading, token) se vuelve blanco y quedaba blanco sobre
          blanco, invisible. bg-bg-surface sí cambia con el tema. */}
      <aside className="w-72 flex-shrink-0 border-r border-border bg-bg-surface flex flex-col">

        {/* Buscador */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input
              ref={filtroRef}
              type="text"
              placeholder="Código o descripción..."
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
              className="w-full pl-7 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-focus-ring bg-bg-subtle text-text"
              autoFocus
            />
          </div>
        </div>

        {/* Selector de cliente — siempre visible, no depende de tener un producto elegido */}
        <div className="px-3 py-2.5 border-b border-border">
          <p className="text-[10px] font-semibold text-text-subtle uppercase tracking-wide mb-1.5">Cliente</p>
          <select
            value={clienteId}
            onChange={e => setClienteId(e.target.value)}
            className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-bg-subtle text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
          >
            <option value="">Todos los clientes</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        {/* Selector de categorías */}
        {!cargandoRefs && categorias.length > 0 && (
          <div className="px-3 py-2.5 border-b border-border bg-bg-subtle/60">
            <p className="text-[10px] font-semibold text-text-subtle uppercase tracking-wide mb-2 flex items-center gap-1">
              <Tag size={10} /> Categoría
            </p>
            <div className="flex flex-wrap gap-1.5">
              {/* Chips de filtro -- cuarzo (bg-accent), igual que en /catalogo. */}
              <button
                onClick={() => setCatFiltro(null)}
                className={`text-[11px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                  !categoriaFiltro
                    ? 'bg-bg-accent text-text-on-accent border-bg-accent'
                    : 'bg-bg-surface text-text-muted border-border hover:border-border-strong'
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
                      ? 'bg-bg-accent text-text-on-accent border-bg-accent'
                      : 'bg-bg-surface text-text-muted border-border hover:border-ultramar hover:text-ultramar'
                  }`}
                >
                  {nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Contador */}
        <div className="px-3 py-1.5 border-b border-border flex items-center justify-between">
          <p className="text-[11px] text-text-subtle">
            {cargandoRefs
              ? 'Cargando...'
              : `${refsFiltradas.length} referencia${refsFiltradas.length !== 1 ? 's' : ''}${categoriaFiltro ? '' : ''}`
            }
          </p>
          {seleccionado && (
            <button
              onClick={() => setSeleccionado(null)}
              className="text-[11px] font-medium text-text-link hover:underline"
            >
              Todos
            </button>
          )}
        </div>

        {/* Lista de referencias */}
        <div className="flex-1 overflow-y-auto">
          {cargandoRefs ? (
            <div className="p-4 text-xs text-text-subtle text-center">Cargando...</div>
          ) : refsFiltradas.length === 0 ? (
            <div className="p-4 text-xs text-text-subtle text-center">Sin resultados</div>
          ) : (
            refsFiltradas.map(r => (
              // Fila seleccionada -- bg-selected (cuarzo-soft), el rol que el
              // sistema de Marta define para "fila seleccionada en tablas,
              // opción activa de menús" (antes era un bloque navy sólido).
              <button
                key={r.codigo_pdf}
                onClick={() => setSeleccionado(r)}
                className={`w-full text-left px-3 py-2.5 border-b border-border transition-colors ${
                  seleccionado?.codigo_pdf === r.codigo_pdf
                    ? 'bg-bg-selected'
                    : 'hover:bg-bg-subtle'
                }`}
              >
                <p className={`text-text-code ${
                  seleccionado?.codigo_pdf === r.codigo_pdf ? 'text-text-on-accent' : 'text-text-heading'
                }`}>
                  {r.codigo_pdf}
                </p>
                <p className={`text-xs mt-0.5 line-clamp-1 ${
                  seleccionado?.codigo_pdf === r.codigo_pdf ? 'text-text-muted' : 'text-text-muted'
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
      <main className="flex-1 overflow-y-auto bg-bg-page">
        {!seleccionado && !clienteId ? (
          <div className="flex flex-col items-center justify-center h-full text-text-subtle gap-3">
            <Search size={44} strokeWidth={1} />
            <p className="text-sm text-text-subtle">
              {categoriaFiltro
                ? 'Selecciona una referencia de la categoría'
                : 'Selecciona una referencia o un cliente en el panel izquierdo'}
            </p>
          </div>
        ) : (
          <div className="p-6">
            {/* Encabezado */}
            <div className="flex items-start justify-between mb-5">
              <div>
                {seleccionado ? (
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-heading-2 font-display text-text-heading">{seleccionado.codigo_pdf}</h2>
                    {seleccionado.categoria_nombre && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${catColor}`}>
                        {seleccionado.categoria_nombre}
                      </span>
                    )}
                  </div>
                ) : (
                  <h2 className="text-heading-2 font-display text-text-heading">{clienteSeleccionado?.nombre}</h2>
                )}
                <p className="text-text-muted text-sm">
                  {seleccionado
                    ? seleccionado.descripcion_pdf
                    : `Historial de todas las referencias compradas por este cliente`}
                </p>
              </div>
              {seleccionado && clienteSeleccionado && (
                <span className="text-xs px-3 py-1.5 rounded-lg bg-bg-surface border border-border text-text-muted">
                  Filtrado por <span className="font-semibold text-text-heading">{clienteSeleccionado.nombre}</span>
                </span>
              )}
            </div>

            {cargandoDetalle ? (
              <div className="text-center p-10 text-text-subtle text-sm">Cargando historial...</div>
            ) : filas.length === 0 ? (
              <div className="text-center p-10 text-text-subtle text-sm">
                {seleccionado ? 'Sin registros para esta referencia' : 'Sin registros para este cliente'}
              </div>
            ) : (
              <>
                {/* Stats — solo tienen sentido mirando una referencia puntual */}
                {seleccionado && stats && (
                  <div className="grid grid-cols-4 gap-3 mb-5">
                    <div className="bg-bg-surface rounded-xl border border-border p-3 text-center">
                      <p className="text-xs text-text-subtle mb-1">Último precio</p>
                      <p className="font-bold tabular-nums text-text-heading text-base">
                        {filas[0].precio_cliente_usd ? formatUSD(filas[0].precio_cliente_usd) : '—'}
                      </p>
                      {tendencia !== null && (
                        <p className={`text-xs mt-0.5 flex items-center justify-center gap-0.5 ${
                          tendencia > 0 ? 'text-red-500' : tendencia < 0 ? 'text-green-600' : 'text-text-subtle'
                        }`}>
                          {tendencia > 0 ? <TrendingUp size={11} /> : tendencia < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                          {tendencia !== 0 ? formatUSD(Math.abs(tendencia)) : 'Sin cambio'}
                        </p>
                      )}
                    </div>
                    <div className="bg-bg-surface rounded-xl border border-border p-3 text-center">
                      <p className="text-xs text-text-subtle mb-1">Rango precios</p>
                      <p className="font-semibold text-text text-sm">
                        {formatUSD(stats.precioMin)} – {formatUSD(stats.precioMax)}
                      </p>
                    </div>
                    <div className="bg-bg-surface rounded-xl border border-border p-3 text-center">
                      <p className="text-xs text-text-subtle mb-1">Último costo China</p>
                      <p className="font-semibold text-text-muted text-sm">
                        {filas[0].precio_costo_usd ? formatUSD(filas[0].precio_costo_usd) : '—'}
                      </p>
                    </div>
                    <div className="bg-bg-surface rounded-xl border border-border p-3 text-center">
                      <p className="text-xs text-text-subtle mb-1">Margen promedio</p>
                      <p className={`font-bold text-sm ${
                        stats.margenProm < 0.08 ? 'text-red-500' :
                        stats.margenProm < 0.12 ? 'text-amber-500' : 'text-green-600'
                      }`}>
                        {formatPct(stats.margenProm)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Tabla -- BUG-007: el contenedor era bg-white fijo; el número de
                    proforma y "Precio cliente" usan text-text-heading (token, se
                    vuelve blanco en modo oscuro) y quedaban invisibles. */}
                <div className="bg-bg-surface rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-bg-subtle border-b border-border">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Fecha</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Proforma</th>
                        {seleccionado ? (
                          <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Cliente</th>
                        ) : (
                          <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Código</th>
                        )}
                        <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted">Costo China</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted">Precio cliente</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted">Margen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((f, i) => (
                        <tr key={f.id} className={`border-b border-border ${i === 0 ? 'bg-bg-selected/40' : ''}`}>
                          <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
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
                          <td className="px-4 py-3 text-text-code text-text-heading">
                            {f.proforma_numero}
                          </td>
                          {seleccionado ? (
                            <td className="px-4 py-3 text-xs text-text-muted">
                              {f.clientes?.nombre || '—'}
                            </td>
                          ) : (
                            <td className="px-4 py-3 text-text-code text-text-muted">
                              {f.codigo_pdf}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right text-xs text-text-muted">
                            {f.precio_costo_usd != null ? formatUSD(f.precio_costo_usd) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold tabular-nums text-text-heading">
                            {f.precio_cliente_usd != null ? formatUSD(f.precio_cliente_usd) : '—'}
                          </td>
                          <td className={`px-4 py-3 text-right text-xs font-semibold ${
                            f.margen_pct == null ? 'text-text-subtle' :
                            f.margen_pct < 0.08 ? 'text-red-500' :
                            f.margen_pct < 0.12 ? 'text-amber-500' : 'text-green-600'
                          }`}>
                            {f.margen_pct != null ? formatPct(f.margen_pct) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-2 border-t border-border text-xs text-text-subtle">
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
