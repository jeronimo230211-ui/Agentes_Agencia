'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Pencil, Tag, Plus, Loader2, Sparkles, CheckCircle2, Eye, EyeOff,
  AlertCircle, RefreshCw, Download,
} from 'lucide-react'
import { formatUSD } from '@/lib/precio'
import { useRol } from '@/lib/useRol'
import Migas from '@/components/producto-detalle/Migas'
import GaleriaProducto from '@/components/producto-detalle/GaleriaProducto'
import DestacadosRapidos from '@/components/producto-detalle/DestacadosRapidos'
import EspecificacionesPrincipales from '@/components/producto-detalle/EspecificacionesPrincipales'
import BotonFavorito from '@/components/producto-detalle/BotonFavorito'
import ProductosRelacionados, { type ProductoRelacionado } from '@/components/producto-detalle/ProductosRelacionados'
import { extraerModelo } from '@/lib/especificacionesPrincipales'
import NuevoProductoModal from '@/components/NuevoProductoModal'
import SeleccionarClienteModal, { type ClienteOpcion } from '@/components/SeleccionarClienteModal'
import FijarPrecioEspecialModal from '@/components/FijarPrecioEspecialModal'

interface Dimensiones { largo_mm?: number; ancho_mm?: number; alto_mm?: number }
interface FichaTecnica { campos: { label: string; valor: string }[] }

interface ProductoDetalle {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  imagen_url: string | null
  imagenes_urls: string[] | null
  dimensiones: Dimensiones | null
  precio_fob_usd: number | null
  precio_mayorista: number | null
  precio_detallista: number | null
  cbm_unitario: number | null
  moq: number | null
  color_variante: string | null
  notas: string | null
  estado: string
  categoria: { id: string; nombre: string } | null
  tiene_historial: boolean
  veces_vendido: number | null
  descripcion_corta_es: string | null
  descripcion_corta_en: string | null
  descripcion_larga_es: string | null
  descripcion_larga_en: string | null
  ficha_tecnica: FichaTecnica | null
  ficha_tecnica_estado: 'borrador' | 'aprobada' | null
}

interface PrecioEspecialFila {
  id: string
  cliente_id: string
  precio_usd: number
  motivo: string | null
  cliente: { nombre: string } | null
}

type IdiomaFicha = 'es' | 'en'

function Skeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-6xl mx-auto animate-pulse">
      <div className="h-4 w-48 bg-gray-200 rounded mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-[1.27fr_1fr] gap-8 lg:gap-10">
        <div className="h-80 md:h-[400px] lg:h-[440px] bg-gray-200 rounded-2xl" />
        <div className="space-y-4">
          <div className="h-3 w-24 bg-gray-200 rounded" />
          <div className="h-6 w-3/4 bg-gray-200 rounded" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-16 bg-gray-200 rounded-xl" />
            <div className="h-16 bg-gray-200 rounded-xl" />
            <div className="h-16 bg-gray-200 rounded-xl" />
          </div>
          <div className="h-10 bg-gray-200 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export default function CatalogoDetalleProductoPage({ params }: { params: { id: string } }) {
  const { puedeEditar } = useRol()
  const [estado, setEstado] = useState<'cargando' | 'error' | 'ok'>('cargando')
  const [producto, setProducto] = useState<ProductoDetalle | null>(null)
  const [relacionados, setRelacionados] = useState<ProductoRelacionado[]>([])

  const [estadoFicha, setEstadoFicha] = useState<'borrador' | 'aprobada' | null>(null)
  const [aprobando, setAprobando] = useState(false)
  const [cambiandoVisibilidad, setCambiandoVisibilidad] = useState(false)
  const [idiomaFicha, setIdiomaFicha] = useState<IdiomaFicha>('es')

  const [mostrarEditar, setMostrarEditar] = useState(false)
  const [productoParaPrecioEspecial, setProductoParaPrecioEspecial] = useState(false)
  const [clienteParaPrecioEspecial, setClienteParaPrecioEspecial] = useState<ClienteOpcion | null>(null)
  const [preciosEspeciales, setPreciosEspeciales] = useState<PrecioEspecialFila[]>([])
  const [cargandoPrecios, setCargandoPrecios] = useState(true)
  const [quitando, setQuitando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setEstado('cargando')
    try {
      const res = await fetch(`/api/productos/${params.id}`)
      if (!res.ok) { setEstado('error'); return }
      const { data } = await res.json()
      setProducto(data)
      setEstadoFicha(data.ficha_tecnica_estado)
      setEstado('ok')

      if (data.categoria?.id) {
        const relRes = await fetch(`/api/productos?categoria_id=${data.categoria.id}&limit=9`)
        const { data: relData } = await relRes.json()
        setRelacionados(
          (relData || [])
            .filter((p: { id: string }) => p.id !== data.id)
            .map((p: { id: string; codigo: string; nombre: string; imagen_url: string | null; precio_mayorista: number | null }) => ({
              id: p.id, codigo: p.codigo, nombre: p.nombre, imagen_url: p.imagen_url, precio: p.precio_mayorista,
            }))
        )
      }
    } catch {
      setEstado('error')
    }
  }, [params.id])

  useEffect(() => { cargar() }, [cargar])

  const cargarPreciosEspeciales = useCallback(() => {
    setCargandoPrecios(true)
    fetch(`/api/productos/${params.id}/precios-especiales`)
      .then(r => r.json())
      .then(({ data }) => { setPreciosEspeciales(data || []); setCargandoPrecios(false) })
      .catch(() => setCargandoPrecios(false))
  }, [params.id])

  useEffect(() => { cargarPreciosEspeciales() }, [cargarPreciosEspeciales])

  async function aprobarFicha() {
    setAprobando(true)
    const res = await fetch(`/api/productos/${params.id}/aprobar-ficha`, { method: 'POST' })
    if (res.ok) setEstadoFicha('aprobada')
    setAprobando(false)
  }

  async function toggleVisibilidad() {
    if (!producto) return
    const oculto = producto.estado === 'oculto'
    setCambiandoVisibilidad(true)
    const res = await fetch(`/api/productos/${params.id}/visibilidad`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: oculto ? 'activo' : 'oculto' }),
    })
    setCambiandoVisibilidad(false)
    if (res.ok) cargar()
  }

  async function quitarPrecioEspecial(fila: PrecioEspecialFila) {
    setQuitando(fila.id)
    await fetch(`/api/clientes/${fila.cliente_id}/precios-especiales/${fila.id}`, { method: 'PATCH' })
    setQuitando(null)
    cargarPreciosEspeciales()
  }

  function onProductoGuardado() {
    setMostrarEditar(false)
    cargar()
  }

  function cerrarFlujoPrecioEspecial() {
    setProductoParaPrecioEspecial(false)
    setClienteParaPrecioEspecial(null)
  }

  if (estado === 'cargando') return <Skeleton />

  if (estado === 'error' || !producto) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <Migas catalogoHref="/catalogo" nombreProducto="" />
        <div className="flex flex-col items-center justify-center text-center py-20 bg-white rounded-2xl border" style={{ borderColor: 'var(--ep-border)' }}>
          <AlertCircle size={40} className="mb-3" style={{ color: 'var(--ep-danger)' }} />
          <p className="text-gray-600 font-medium mb-4">No pudimos cargar este producto</p>
          <button
            onClick={cargar}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--ep-navy)' }}
          >
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      </div>
    )
  }

  const oculto = producto.estado === 'oculto'
  const dim = producto.dimensiones
  const dimTexto = dim && (dim.largo_mm || dim.ancho_mm || dim.alto_mm)
    ? [dim.largo_mm, dim.ancho_mm, dim.alto_mm].filter(Boolean).join(' × ') + ' mm'
    : null

  const imagenes = [producto.imagen_url, ...(producto.imagenes_urls || [])].filter((u): u is string => !!u)

  const descripcionCorta = idiomaFicha === 'es' ? producto.descripcion_corta_es : producto.descripcion_corta_en
  const descripcionLarga = idiomaFicha === 'es' ? producto.descripcion_larga_es : producto.descripcion_larga_en
  const hayFicha = (producto.ficha_tecnica?.campos?.length ?? 0) > 0
  const hayContenidoFicha = hayFicha || !!producto.descripcion_larga_es || !!producto.descripcion_larga_en
  const modelo = extraerModelo(producto.ficha_tecnica?.campos)

  return (
    <div className="p-4 sm:p-6 lg:p-10 pb-24 lg:pb-8 max-w-6xl mx-auto">
      {mostrarEditar && (
        <NuevoProductoModal
          producto={{
            id: producto.id, codigo: producto.codigo, nombre: producto.nombre,
            descripcion: producto.descripcion, imagen_url: producto.imagen_url,
            precio_fob_usd: producto.precio_fob_usd, precio_mayorista: producto.precio_mayorista,
            precio_detallista: producto.precio_detallista, cbm_unitario: producto.cbm_unitario,
            moq: producto.moq, dimensiones: producto.dimensiones, notas: producto.notas,
            categoria: producto.categoria,
          }}
          onClose={() => setMostrarEditar(false)}
          onSaved={onProductoGuardado}
        />
      )}

      {productoParaPrecioEspecial && !clienteParaPrecioEspecial && (
        <SeleccionarClienteModal
          titulo={`Precio especial para ${producto.codigo}`}
          onSeleccionar={setClienteParaPrecioEspecial}
          onClose={cerrarFlujoPrecioEspecial}
        />
      )}

      {productoParaPrecioEspecial && clienteParaPrecioEspecial && (
        <FijarPrecioEspecialModal
          clienteId={clienteParaPrecioEspecial.id}
          codigo={producto.codigo}
          onClose={cerrarFlujoPrecioEspecial}
          onGuardado={() => { cerrarFlujoPrecioEspecial(); cargarPreciosEspeciales() }}
        />
      )}

      <Migas catalogoHref="/catalogo" categoriaNombre={producto.categoria?.nombre} nombreProducto={producto.nombre} />

      <div className="grid grid-cols-1 lg:grid-cols-[1.27fr_1fr] gap-8 lg:gap-10">
        {/* Galería — min-w-0: un grid item sin esto nunca se achica por
            debajo del ancho de su contenido más largo (bug clásico de CSS
            Grid). Sin esto, una fila de destacados con un chip largo infla
            toda la columna y aplasta la galería. */}
        <div className="min-w-0">
          <GaleriaProducto
            imagenes={imagenes}
            nombre={producto.nombre}
            placeholderTexto="Sin foto disponible"
          />
        </div>

        {/* Panel de acción — interno */}
        <div className="space-y-5 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ep-navy)' }}>{producto.codigo}</p>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-800 leading-tight mt-0.5">{producto.nombre}</h1>
              <p className="text-xs text-gray-500 mt-1">
                {modelo ? `Modelo ${modelo} | Código ${producto.codigo}` : `Código: ${producto.codigo}`}
              </p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className={
                  producto.estado === 'oculto' ? 'ep-badge-oculto' :
                  producto.estado === 'descontinuado' ? 'ep-badge-descontinuado' :
                  producto.estado === 'pendiente' ? 'ep-badge-pendiente' : 'ep-badge-activo'
                }>
                  {producto.estado}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                  estadoFicha === 'aprobada'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-amber-50 text-amber-700 border-amber-100'
                }`}>
                  Ficha {estadoFicha === 'aprobada' ? 'aprobada' : 'borrador'}
                </span>
              </div>
            </div>
            <BotonFavorito productoId={producto.id} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl p-3 border" style={{ background: '#F8FAFC', borderColor: 'var(--ep-border)' }}>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">FOB China</p>
              <p className="text-sm font-bold text-gray-800">
                {producto.precio_fob_usd != null ? formatUSD(producto.precio_fob_usd) : '—'}
              </p>
            </div>
            <div className="rounded-xl p-3 border" style={{ background: '#F8FAFC', borderColor: 'var(--ep-border)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'rgba(0,13,102,0.6)' }}>Mayorista</p>
              <p className="text-lg font-extrabold" style={{ color: 'var(--ep-navy)' }}>
                {producto.precio_mayorista != null ? formatUSD(producto.precio_mayorista) : '—'}
              </p>
            </div>
            <div className="rounded-xl p-3 border" style={{ background: '#F8FAFC', borderColor: 'var(--ep-border)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'rgba(0,13,102,0.6)' }}>Detallista</p>
              <p className="text-lg font-extrabold" style={{ color: 'var(--ep-navy)' }}>
                {producto.precio_detallista != null ? formatUSD(producto.precio_detallista) : '—'}
              </p>
            </div>
          </div>

          {dimTexto && (
            <p className="text-sm text-gray-500">
              {dimTexto}
              {producto.moq != null && <> · MOQ {producto.moq}</>}
              {producto.cbm_unitario != null && <> · {producto.cbm_unitario} CBM</>}
            </p>
          )}

          <DestacadosRapidos
            colorVariante={producto.color_variante}
            dimensiones={dimTexto}
            moq={producto.moq}
            cbmUnitario={producto.cbm_unitario}
            camposFicha={producto.ficha_tecnica?.campos}
          />

          {producto.descripcion && (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{producto.descripcion}</p>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Historial de venta</p>
            {producto.tiene_historial ? (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                Con historial{producto.veces_vendido ? ` · ${producto.veces_vendido}x` : ''}
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-50 text-gray-400 border border-gray-100">
                Sin historial
              </span>
            )}
          </div>

          {producto.notas && (
            <div className="rounded-xl p-3" style={{ background: 'var(--ep-warning-bg)', border: '1px solid #FDE68A' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--ep-warning)' }}>Notas internas</p>
              <p className="text-sm whitespace-pre-line" style={{ color: '#92400E' }}>{producto.notas}</p>
            </div>
          )}

          {(puedeEditar || preciosEspeciales.length > 0) && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Precios especiales por cliente
              </p>
              {cargandoPrecios ? (
                <Loader2 size={16} className="animate-spin text-gray-300" />
              ) : (
                <div className="space-y-1.5">
                  {preciosEspeciales.map(fila => (
                    <div key={fila.id} className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Tag size={12} className="text-amber-500 flex-shrink-0" />
                        <span className="text-sm text-gray-800 truncate">
                          {fila.cliente?.nombre || 'Cliente'}: <strong className="text-amber-700">{formatUSD(fila.precio_usd)}</strong>
                          {fila.motivo && <span className="text-gray-400"> — {fila.motivo}</span>}
                        </span>
                      </div>
                      {puedeEditar && (
                        <button
                          onClick={() => quitarPrecioEspecial(fila)}
                          disabled={quitando === fila.id}
                          className="text-xs text-gray-400 hover:text-red-500 hover:underline flex-shrink-0 disabled:opacity-50"
                        >
                          {quitando === fila.id ? 'Quitando...' : 'Quitar'}
                        </button>
                      )}
                    </div>
                  ))}
                  {puedeEditar && (
                    <button
                      onClick={() => setProductoParaPrecioEspecial(true)}
                      className="flex items-center gap-1.5 text-sm font-medium hover:underline mt-1"
                      style={{ color: 'var(--ep-navy)' }}
                    >
                      <Plus size={14} /> Fijar precio especial para otro cliente
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Acciones — sticky en móvil */}
          <div className="fixed bottom-0 left-0 right-0 lg:static bg-white lg:bg-transparent border-t lg:border-t-0 p-4 lg:p-0 z-20 flex gap-2" style={{ borderColor: 'var(--ep-border)' }}>
            {puedeEditar && (
              <button
                onClick={toggleVisibilidad}
                disabled={cambiandoVisibilidad}
                className={`flex-1 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 border disabled:opacity-60 ${
                  oculto ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-amber-200 text-amber-700 hover:bg-amber-50'
                }`}
                style={{ minHeight: 48 }}
              >
                {cambiandoVisibilidad ? <Loader2 size={14} className="animate-spin" /> : oculto ? <Eye size={14} /> : <EyeOff size={14} />}
                {oculto ? 'Mostrar en catálogo' : 'Ocultar del catálogo'}
              </button>
            )}
            {puedeEditar && (
              <button
                onClick={() => setMostrarEditar(true)}
                className="flex-1 py-3 rounded-lg font-bold text-white text-sm flex items-center justify-center gap-2"
                style={{ background: 'var(--ep-navy)', minHeight: 48 }}
              >
                <Pencil size={14} /> Editar producto
              </button>
            )}
          </div>

          <EspecificacionesPrincipales
            colorVariante={producto.color_variante}
            dimensiones={dimTexto}
            moq={producto.moq}
            cbmUnitario={producto.cbm_unitario}
            camposFicha={producto.ficha_tecnica?.campos}
          />
        </div>
      </div>

      {/* Ficha técnica */}
      {hayContenidoFicha ? (
        <div className="rounded-2xl mt-2 mb-8 overflow-hidden border" style={{ borderColor: 'var(--ep-border)' }}>
          {/* Cabecera — barra navy sólida, ancho completo de la tarjeta */}
          <div className="h-12 px-4 flex items-center justify-between gap-2 flex-wrap" style={{ background: 'var(--ep-navy)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 text-white">
              <Sparkles size={12} /> Ficha técnica
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex rounded-full overflow-hidden text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <button
                  onClick={() => setIdiomaFicha('es')}
                  className="px-2.5 py-1 transition-colors"
                  style={idiomaFicha === 'es' ? { background: '#fff', color: 'var(--ep-navy)' } : { color: '#fff' }}
                >ES</button>
                <button
                  onClick={() => setIdiomaFicha('en')}
                  className="px-2.5 py-1 transition-colors"
                  style={idiomaFicha === 'en' ? { background: '#fff', color: 'var(--ep-navy)' } : { color: '#fff' }}
                >EN</button>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                estadoFicha === 'aprobada' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
              }`}>
                {estadoFicha === 'aprobada' ? 'Aprobada' : 'Borrador'}
              </span>
            </div>
          </div>

          <div className="p-4">
            {descripcionCorta && <p className="text-sm font-semibold italic text-gray-600 mb-1.5">{descripcionCorta}</p>}
            {descripcionLarga && <p className="text-sm text-gray-700 leading-relaxed mb-3">{descripcionLarga}</p>}

            {hayFicha && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {producto.ficha_tecnica!.campos.map((c, i) => (
                  <div key={i} className="rounded-xl p-3 border" style={{ background: '#F8FAFC', borderColor: 'var(--ep-border)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ep-navy)' }}>{c.label}</p>
                    <p className="text-xs font-medium text-gray-800">{c.valor}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              {puedeEditar && estadoFicha !== 'aprobada' && (
                <button
                  onClick={aprobarFicha}
                  disabled={aprobando}
                  className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                >
                  <CheckCircle2 size={13} />
                  {aprobando ? 'Aprobando...' : 'Aprobar — mostrar al cliente'}
                </button>
              )}
              <a
                href={`/api/productos/${producto.id}/ficha-pdf?idioma=${idiomaFicha}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold hover:underline"
                style={{ color: 'var(--ep-navy)' }}
              >
                <Download size={13} /> Descargar ficha técnica (PDF)
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-dashed rounded-xl p-4 mt-2 mb-8 text-center" style={{ borderColor: 'var(--ep-border)' }}>
          <p className="text-sm text-gray-400">Sin ficha técnica — campos pendientes de carga</p>
        </div>
      )}

      <ProductosRelacionados
        productos={relacionados}
        hrefBuilder={id => `/catalogo/${id}`}
      />
    </div>
  )
}
