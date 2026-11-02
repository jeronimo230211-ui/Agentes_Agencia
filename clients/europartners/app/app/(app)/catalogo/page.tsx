'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Filter, RefreshCw, Package, Plus, Eye, EyeOff } from 'lucide-react'
import { formatUSD } from '@/lib/precio'
import { useRol } from '@/lib/useRol'
import NuevoProductoModal from '@/components/NuevoProductoModal'
import Paginacion from '@/components/Paginacion'

// 24-40 referencias por página (rango pedido) -- con grillas de 2 a 5
// columnas según breakpoint, 30 reparte bien en la mayoría.
const TAMANO_PAGINA = 30

interface Categoria {
  id: string
  nombre: string
  activo: boolean
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
  descripcion_larga_es: string | null
  descripcion_larga_en: string | null
  ficha_tecnica: { campos: { label: string; valor: string }[] } | null
  ficha_tecnica_estado: 'borrador' | 'aprobada' | null
}

function ProductCard({ p, onClick }: { p: Producto; onClick: () => void }) {
  const [imgError, setImgError] = useState(false)
  const oculto = p.estado === 'oculto'

  return (
    <div
      onClick={onClick}
      className={`group bg-bg-surface rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col cursor-pointer ${
        oculto ? 'border-amber-200 opacity-70' : 'border-border hover:border-border-strong'
      }`}
    >
      {/* Imagen */}
      <div className="relative bg-bg-subtle h-40 flex items-center justify-center overflow-hidden">
        {p.imagen_url && !imgError ? (
          <img
            src={p.imagen_url}
            alt={p.nombre}
            className="w-full h-full object-contain p-3"
            onError={() => setImgError(true)}
          />
        ) : (
          <Package size={32} className="text-text-subtle" />
        )}
        {oculto && (
          <span className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
            <EyeOff size={10} /> Oculto
          </span>
        )}
        {/* bg-bg-surface, no bg-white: en modo oscuro bg-surface es oscuro y el
            ícono (text-text-heading) se vuelve blanco -- con bg-white fijo quedaba
            blanco sobre blanco e invisible (BUG-007). */}
        <div className="absolute top-1.5 right-1.5 bg-bg-surface/90 rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
          <Eye size={13} className="text-text-heading" />
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-0.5">
        <p className="text-text-code text-text-heading">{p.codigo}</p>
        <p className="text-sm text-text font-medium leading-tight line-clamp-2">{p.nombre}</p>
        <p className="text-xs text-text-subtle">{p.categoria?.nombre || '—'}</p>
        {p.precio_mayorista != null ? (
          <p className="text-sm font-bold text-text-heading tabular-nums mt-1">{formatUSD(p.precio_mayorista)}</p>
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
  const router = useRouter()
  const { puedeEditar } = useRol()
  const [productos, setProductos]   = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cargando, setCargando]     = useState(true)
  const [busqueda, setBusqueda]     = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [mostrarOcultos, setMostrarOcultos] = useState(false)
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
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
  }, [busqueda, categoriaId, mostrarOcultos, pagina])

  async function cargar() {
    setCargando(true)
    // Antes traía todo con limit=1000 de una sola vez ("scroll infinito" —
    // Jerónimo lo rechazó, pidió paginación real estilo Amazon/Homecenter).
    // Ahora el corte de página va DESPUÉS del filtro, en el servidor
    // (/api/productos ya hacía el filtro de q/categoria_id ahí mismo).
    const params = new URLSearchParams({
      limit: String(TAMANO_PAGINA),
      offset: String((pagina - 1) * TAMANO_PAGINA),
    })
    if (busqueda.trim())  params.set('q', busqueda.trim())
    if (categoriaId)      params.set('categoria_id', categoriaId)
    // Sin esto el GET solo trae estado='activo' — un producto apagado
    // desaparecería también de este panel y no habría forma de reactivarlo.
    if (mostrarOcultos)   params.set('incluir_ocultos', '1')
    const res = await fetch(`/api/productos?${params}`)
    const { data, total: totalRes } = await res.json()
    setProductos(data || [])
    setTotal(totalRes ?? 0)
    setCargando(false)
  }

  // Cambiar de filtro siempre vuelve a la página 1 -- si no, buscar algo
  // nuevo mientras estás en la página 4 mostraría "sin resultados" aunque sí
  // los haya en la página 1 de ese filtro nuevo.
  function cambiarBusqueda(valor: string) { setBusqueda(valor); setPagina(1) }
  function cambiarCategoria(id: string) { setCategoriaId(id); setPagina(1) }
  function cambiarMostrarOcultos(valor: boolean) { setMostrarOcultos(valor); setPagina(1) }

  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA))

  function irAPagina(p: number) {
    setPagina(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function toggleCategoria(cat: Categoria) {
    const nuevoActivo = !cat.activo
    setCategorias(prev => prev.map(c => c.id === cat.id ? { ...c, activo: nuevoActivo } : c))
    const res = await fetch(`/api/categorias/${cat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: nuevoActivo }),
    })
    if (!res.ok) {
      // revertir si falló
      setCategorias(prev => prev.map(c => c.id === cat.id ? { ...c, activo: cat.activo } : c))
    }
  }

  return (
    <div className="p-8">
      {mostrarNuevo && (
        <NuevoProductoModal
          onClose={() => setMostrarNuevo(false)}
          onSaved={() => { setMostrarNuevo(false); cargar() }}
        />
      )}

      {/* Header -- BUG-012: en mobile el botón compartía fila con el h1 sin wrap
          (justify-between sin flex-col), el título quedaba confinado a ~154px y se
          partía en 3 líneas. flex-col en mobile baja el botón debajo del título. */}
      <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-heading-1 font-display text-text-heading mb-1">Catálogo de Productos</h1>
          <p className="text-text-muted text-sm">
            {cargando ? 'Cargando...' : `${total} referencia${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        {puedeEditar && (
          // Única acción primaria de esta pantalla -- bg-action-primary (indigo).
          <button
            onClick={() => setMostrarNuevo(true)}
            className="flex items-center gap-1.5 text-button text-on-action-primary bg-action-primary hover:bg-action-primary-hover px-4 py-2 rounded-lg flex-none"
          >
            <Plus size={16} /> Nuevo producto
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
          <input
            type="text"
            placeholder="Código, nombre o descripción..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-xl bg-bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
            value={busqueda}
            onChange={e => cambiarBusqueda(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-text-subtle" />
          {/* Chips de filtro -- cuarzo (bg-accent), nunca el color de acción primaria. */}
          <button
            onClick={() => cambiarCategoria('')}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              !categoriaId ? 'bg-bg-accent text-text-on-accent' : 'bg-bg-subtle text-text-muted hover:bg-border'
            }`}
          >
            Todas
          </button>
          {categorias.map(cat => (
            <span
              key={cat.id}
              className={`flex items-center gap-1 text-xs rounded-full font-medium transition-colors pl-3 pr-1.5 py-1.5 ${
                categoriaId === cat.id
                  ? 'bg-bg-accent text-text-on-accent'
                  : cat.activo
                    ? 'bg-bg-subtle text-text-muted hover:bg-border'
                    : 'bg-amber-50 text-amber-600 border border-amber-200'
              }`}
            >
              <button onClick={() => cambiarCategoria(categoriaId === cat.id ? '' : cat.id)}>
                {cat.nombre}{!cat.activo && ' (oculta)'}
              </button>
              {puedeEditar && (
                <button
                  onClick={() => toggleCategoria(cat)}
                  title={cat.activo ? 'Ocultar categoría del catálogo público' : 'Mostrar categoría en el catálogo público'}
                  className="opacity-60 hover:opacity-100 p-0.5"
                >
                  {cat.activo ? <Eye size={11} /> : <EyeOff size={11} />}
                </button>
              )}
            </span>
          ))}
        </div>

        {puedeEditar && (
          <label className="flex items-center gap-1.5 text-xs text-gray-500 font-medium cursor-pointer select-none ml-auto">
            <input
              type="checkbox"
              checked={mostrarOcultos}
              onChange={e => cambiarMostrarOcultos(e.target.checked)}
              className="rounded accent-action-primary"
            />
            Mostrar ocultos
          </label>
        )}
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
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {productos.map(p => (
              <ProductCard key={p.id} p={p} onClick={() => router.push(`/catalogo/${p.id}`)} />
            ))}
          </div>

          <Paginacion pagina={pagina} totalPaginas={totalPaginas} onCambiar={irAPagina} />
        </>
      )}

      <div className="mt-6 text-xs text-gray-400 text-right">
        {total} producto{total !== 1 ? 's' : ''} · FOB = último costo China registrado
      </div>
    </div>
  )
}
