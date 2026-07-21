'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Filter, RefreshCw, Package } from 'lucide-react'
import { formatUSD } from '@/lib/precio'

interface Categoria {
  id: string
  nombre: string
}

interface Dimensiones {
  largo_mm?: number
  ancho_mm?: number
  alto_mm?: number
  cbm_unitario?: number
}

interface Producto {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  imagen_url: string | null
  dimensiones: Dimensiones | null
  precio_fob_usd: number | null
  precio_fob_fecha: string | null
  estado: string
  notas: string | null
  categoria: Categoria | null
  precio_mayorista: number | null
  precio_detallista: number | null
  cbm_unitario: number | null
  moq: number | null
  color_variante: string | null
  tiene_historial: boolean
  veces_vendido: number | null
  fecha_ultima_venta: string | null
  precio_cliente_historico_ultimo: number | null
}

const CAT_COLOR: Record<string, string> = {
  'Countertop bathroom vanities': 'bg-blue-50 text-blue-700 border-blue-100',
  'Big Basins':                   'bg-violet-50 text-violet-700 border-violet-100',
  'Sintered Stone Sinks':         'bg-amber-50 text-amber-700 border-amber-100',
  'Mirrors':                      'bg-emerald-50 text-emerald-700 border-emerald-100',
  'Laundry Sinks':                'bg-cyan-50 text-cyan-700 border-cyan-100',
  'Toilets':                      'bg-sky-50 text-sky-700 border-sky-100',
  'Pedestal Washbasins':          'bg-teal-50 text-teal-700 border-teal-100',
  'Urinals':                      'bg-lime-50 text-lime-700 border-lime-100',
  'Bathroom Sinks':               'bg-indigo-50 text-indigo-700 border-indigo-100',
  'Toilet Parts':                 'bg-slate-50 text-slate-700 border-slate-100',
  'Shower Enclosures':            'bg-purple-50 text-purple-700 border-purple-100',
  'Bathtubs':                     'bg-orange-50 text-orange-700 border-orange-100',
  'Wash Down Toilets':            'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100',
  'Voltage Protectors':           'bg-rose-50 text-rose-700 border-rose-100',
}

function ProductCard({ p }: { p: Producto }) {
  const [imgError, setImgError] = useState(false)
  const catColor = CAT_COLOR[p.categoria?.nombre || ''] || 'bg-gray-100 text-gray-500 border-gray-200'
  const dim = p.dimensiones

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
      {/* Imagen */}
      <div className="relative bg-gray-50 h-44 flex items-center justify-center overflow-hidden">
        {p.imagen_url && !imgError ? (
          <img
            src={p.imagen_url}
            alt={p.nombre}
            className="w-full h-full object-contain p-3"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-300">
            <Package size={36} />
            <span className="text-xs">Sin imagen</span>
          </div>
        )}
        {/* Badge categoría */}
        <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full font-medium border ${catColor}`}>
          {p.categoria?.nombre || '—'}
        </span>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-1 flex-1">
        <p className="font-mono text-xs font-bold text-[#1E3A5F]">{p.codigo}</p>
        <p className="text-sm text-gray-800 font-medium leading-tight line-clamp-2">{p.nombre}</p>
        {p.descripcion && p.descripcion !== p.nombre && (
          <p className="text-xs text-gray-400 line-clamp-1">{p.descripcion}</p>
        )}

        {/* Dimensiones */}
        {dim && (dim.largo_mm || dim.ancho_mm) && (
          <p className="text-xs text-gray-400 mt-1">
            {[dim.largo_mm, dim.ancho_mm, dim.alto_mm].filter(Boolean).join(' × ')} mm
          </p>
        )}

        {/* Precio */}
        <div className="mt-auto pt-3 border-t border-gray-50">
          {p.precio_fob_usd != null ? (
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-gray-400">FOB China</span>
              <span className="text-base font-bold text-gray-800">{formatUSD(p.precio_fob_usd)}</span>
            </div>
          ) : (
            <span className="text-xs text-gray-300 italic">Sin precio FOB</span>
          )}

          {/* Historial de venta — para que Deisy sepa si ya se ha vendido antes */}
          <div className="mt-1.5">
            {p.tiene_historial ? (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                Con historial{p.veces_vendido ? ` · ${p.veces_vendido}x` : ''}
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-50 text-gray-400 border border-gray-100">
                Sin historial
              </span>
            )}
          </div>

          {p.notas && (
            <p className="text-xs text-amber-600 mt-1">{p.notas}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CatalogoPage() {
  const [productos, setProductos]   = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cargando, setCargando]     = useState(true)
  const [busqueda, setBusqueda]     = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    fetch('/api/categorias')
      .then(r => r.json())
      .then(({ data }) => setCategorias(data || []))
  }, [])

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => cargar(), busqueda ? 300 : 0)
    return () => clearTimeout(timerRef.current)
  }, [busqueda, categoriaId])

  async function cargar() {
    setCargando(true)
    const params = new URLSearchParams({ limit: '300' })
    if (busqueda.trim())  params.set('q', busqueda.trim())
    if (categoriaId)      params.set('categoria_id', categoriaId)
    const res = await fetch(`/api/productos?${params}`)
    const { data } = await res.json()
    setProductos(data || [])
    setCargando(false)
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F] mb-1">Catálogo de Productos</h1>
        <p className="text-gray-500 text-sm">
          {cargando ? 'Cargando...' : `${productos.length} referencias`}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Código, nombre o descripción..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-gray-400" />
          <button
            onClick={() => setCategoriaId('')}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              !categoriaId ? 'bg-[#1E3A5F] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todas
          </button>
          {categorias.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategoriaId(prev => prev === cat.id ? '' : cat.id)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                categoriaId === cat.id ? 'bg-[#1E3A5F] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de cards */}
      {cargando ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-3" />
          Cargando catálogo...
        </div>
      ) : productos.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p>No se encontraron productos</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {productos.map(p => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}

      <div className="mt-6 text-xs text-gray-400 text-right">
        {productos.length} producto{productos.length !== 1 ? 's' : ''} · FOB = último costo China registrado
      </div>
    </div>
  )
}
