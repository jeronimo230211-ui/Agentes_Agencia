'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Filter, RefreshCw, Package, Plus, Eye } from 'lucide-react'
import { formatUSD } from '@/lib/precio'
import { useRol } from '@/lib/useRol'
import NuevoProductoModal from '@/components/NuevoProductoModal'
import ProductoDetalleInternoModal from '@/components/ProductoDetalleInternoModal'

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

function ProductCard({ p, onClick }: { p: Producto; onClick: () => void }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer"
    >
      {/* Imagen */}
      <div className="relative bg-gray-50 h-40 flex items-center justify-center overflow-hidden">
        {p.imagen_url && !imgError ? (
          <img
            src={p.imagen_url}
            alt={p.nombre}
            className="w-full h-full object-contain p-3"
            onError={() => setImgError(true)}
          />
        ) : (
          <Package size={32} className="text-gray-300" />
        )}
        <div className="absolute top-1.5 right-1.5 bg-white/90 rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
          <Eye size={13} className="text-[#1E3A5F]" />
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-0.5">
        <p className="font-mono text-xs font-bold text-[#1E3A5F]">{p.codigo}</p>
        <p className="text-sm text-gray-800 font-medium leading-tight line-clamp-2">{p.nombre}</p>
        <p className="text-xs text-gray-400">{p.categoria?.nombre || '—'}</p>
        {p.precio_mayorista != null ? (
          <p className="text-sm font-bold text-[#1E3A5F] mt-1">{formatUSD(p.precio_mayorista)}</p>
        ) : p.precio_fob_usd != null ? (
          <p className="text-xs text-gray-400 mt-1">FOB {formatUSD(p.precio_fob_usd)}</p>
        ) : (
          <p className="text-xs text-gray-300 italic mt-1">Sin precio</p>
        )}
      </div>
    </div>
  )
}

export default function CatalogoPage() {
  const { puedeEditar } = useRol()
  const [productos, setProductos]   = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cargando, setCargando]     = useState(true)
  const [busqueda, setBusqueda]     = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null)
  const [productoDetalle, setProductoDetalle] = useState<Producto | null>(null)
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
      {mostrarNuevo && (
        <NuevoProductoModal
          onClose={() => setMostrarNuevo(false)}
          onSaved={() => { setMostrarNuevo(false); cargar() }}
        />
      )}

      {productoEditando && (
        <NuevoProductoModal
          producto={productoEditando}
          onClose={() => setProductoEditando(null)}
          onSaved={() => { setProductoEditando(null); cargar() }}
        />
      )}

      {productoDetalle && (
        <ProductoDetalleInternoModal
          producto={productoDetalle}
          onClose={() => setProductoDetalle(null)}
          onEditar={puedeEditar ? () => { setProductoEditando(productoDetalle); setProductoDetalle(null) } : undefined}
        />
      )}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F] mb-1">Catálogo de Productos</h1>
          <p className="text-gray-500 text-sm">
            {cargando ? 'Cargando...' : `${productos.length} referencias`}
          </p>
        </div>
        {puedeEditar && (
          <button
            onClick={() => setMostrarNuevo(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-white px-4 py-2 rounded-lg flex-none"
            style={{ background: '#1E3A5F' }}
          >
            <Plus size={16} /> Nuevo producto
          </button>
        )}
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
            <ProductCard key={p.id} p={p} onClick={() => setProductoDetalle(p)} />
          ))}
        </div>
      )}

      <div className="mt-6 text-xs text-gray-400 text-right">
        {productos.length} producto{productos.length !== 1 ? 's' : ''} · FOB = último costo China registrado
      </div>
    </div>
  )
}
