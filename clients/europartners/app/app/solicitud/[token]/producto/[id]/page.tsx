'use client'
import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react'
import { formatUSD } from '@/lib/precio'
import { useSolicitudCarrito } from '@/lib/SolicitudCarritoContext'
import QuantityStepper from '@/components/QuantityStepper'
import Migas from '@/components/producto-detalle/Migas'
import GaleriaProducto from '@/components/producto-detalle/GaleriaProducto'
import DestacadosRapidos from '@/components/producto-detalle/DestacadosRapidos'
import EspecificacionesPrincipales from '@/components/producto-detalle/EspecificacionesPrincipales'
import BotonFavorito from '@/components/producto-detalle/BotonFavorito'
import ProductosRelacionados, { type ProductoRelacionado } from '@/components/producto-detalle/ProductosRelacionados'
import { extraerModelo } from '@/lib/especificacionesPrincipales'

interface ProductoPublico {
  id: string
  categoria_id: string | null
  codigo: string
  nombre: string
  descripcion: string | null
  imagen_url: string | null
  imagenes_urls?: string[] | null
  dimensiones?: string | null
  color_variante?: string | null
  moq?: string | null
  cbm_unitario?: number | null
  precio_cliente?: number | null
  descripcion_corta_en?: string | null
  descripcion_larga_en?: string | null
  ficha_tecnica?: { campos: { label: string; valor: string }[] } | null
}

function Skeleton() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--ep-light)' }}>
      <div className="max-w-5xl mx-auto px-4 py-6 animate-pulse">
        <div className="h-4 w-40 bg-gray-200 rounded mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-[1.27fr_1fr] gap-8 lg:gap-10">
          <div className="h-80 md:h-[400px] lg:h-[440px] bg-gray-200 rounded-2xl" />
          <div className="space-y-4">
            <div className="h-3 w-24 bg-gray-200 rounded" />
            <div className="h-6 w-3/4 bg-gray-200 rounded" />
            <div className="h-8 w-32 bg-gray-200 rounded" />
            <div className="h-12 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProductoPublicoPage({ params }: { params: { token: string; id: string } }) {
  const { cantidadDe, fijarCantidad } = useSolicitudCarrito()
  const [estado, setEstado] = useState<'cargando' | 'error' | 'invalid' | 'ok'>('cargando')
  const [producto, setProducto] = useState<ProductoPublico | null>(null)
  const [relacionados, setRelacionados] = useState<ProductoRelacionado[]>([])
  const [cantidad, setCantidad] = useState(1)
  const [estadoBoton, setEstadoBoton] = useState<'idle' | 'agregado' | 'error'>('idle')

  const cargar = useCallback(async () => {
    setEstado('cargando')
    try {
      const res = await fetch(`/api/solicitud/${params.token}/producto/${params.id}`)
      if (res.status === 404) {
        const j = await res.json().catch(() => null)
        setEstado(j?.error === 'Invalid link' ? 'invalid' : 'error')
        return
      }
      if (!res.ok) { setEstado('error'); return }
      const json = await res.json()
      setProducto(json.producto)
      setRelacionados(
        (json.relacionados || []).map((p: ProductoPublico) => ({
          id: p.id, codigo: p.codigo, nombre: p.nombre, imagen_url: p.imagen_url, precio: p.precio_cliente,
        }))
      )
      setEstado('ok')
    } catch {
      setEstado('error')
    }
  }, [params.token, params.id])

  useEffect(() => { cargar() }, [cargar])

  // Si ya está en la solicitud en curso, arranca el stepper en esa cantidad
  // (el badge persistente usa el mismo valor, leído del contexto real del
  // carrito, no de un estado local que se pierda al volver a esta página).
  useEffect(() => {
    if (producto) {
      const enCarrito = cantidadDe(producto.id)
      setCantidad(enCarrito > 0 ? enCarrito : 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto?.id])

  function agregar() {
    if (!producto) return
    try {
      fijarCantidad({ id: producto.id, codigo: producto.codigo, nombre: producto.nombre, precio_cliente: producto.precio_cliente }, cantidad)
      setEstadoBoton('agregado')
      setTimeout(() => setEstadoBoton('idle'), 1200)
    } catch {
      setEstadoBoton('error')
    }
  }

  if (estado === 'cargando') return <Skeleton />

  if (estado === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--ep-light)' }}>
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Invalid link</h1>
          <p className="text-gray-500 text-sm">This order link is not valid. Please contact Europartners to get your correct link.</p>
        </div>
      </div>
    )
  }

  if (estado === 'error' || !producto) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--ep-light)' }}>
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={40} className="mb-3 mx-auto" style={{ color: 'var(--ep-danger)' }} />
          <p className="text-gray-600 font-medium mb-4">We couldn&apos;t load this product</p>
          <button
            onClick={cargar}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--ep-navy)' }}
          >
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      </div>
    )
  }

  const imagenes = [producto.imagen_url, ...(producto.imagenes_urls || [])].filter((u): u is string => !!u)
  const hayFicha = (producto.ficha_tecnica?.campos?.length ?? 0) > 0
  // Gateado server-side (ficha_tecnica_estado === 'aprobada', ver
  // lib/catalogoPublico.ts) — distinto de producto.descripcion (plano, sin
  // gate, siempre visible) que se muestra aparte más abajo.
  const hayContenidoFicha = hayFicha || !!producto.descripcion_larga_en
  const enCarrito = cantidadDe(producto.id)
  const modelo = extraerModelo(producto.ficha_tecnica?.campos)

  return (
    <div className="min-h-screen" style={{ background: 'var(--ep-light)' }}>
      <div className="max-w-5xl mx-auto px-4 py-6 pb-28 lg:pb-10">
        <Migas
          catalogoHref={`/solicitud/${params.token}`}
          nombreProducto={producto.nombre}
          textoCatalogo="Catalog"
          textoVolver="Back"
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1.27fr_1fr] gap-8 lg:gap-10">
          {/* min-w-0: sin esto un grid item nunca se achica por debajo del
              ancho de su contenido más largo (bug clásico de CSS Grid) */}
          <div className="min-w-0">
            <GaleriaProducto imagenes={imagenes} nombre={producto.nombre} />
          </div>

          {/* Panel de acción — público */}
          <div className="space-y-5 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ep-navy)' }}>{producto.codigo}</p>
                <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-800 leading-tight mt-0.5">{producto.nombre}</h1>
                <p className="text-xs text-gray-500 mt-1">
                  {modelo ? `Model ${modelo} | Code ${producto.codigo}` : `Code: ${producto.codigo}`}
                </p>
              </div>
              <BotonFavorito productoId={producto.id} textoGuardar="Save" textoGuardado="Saved" />
            </div>

            {producto.descripcion_corta_en && (
              <p className="text-sm font-semibold italic text-gray-600">{producto.descripcion_corta_en}</p>
            )}

            {producto.precio_cliente != null && (
              <div
                className="rounded-2xl px-6 py-5"
                style={{ background: 'var(--ep-navy)', boxShadow: '0 4px 16px rgba(0,13,102,0.18)' }}
              >
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--ep-lila-on-navy)' }}>Your Price</p>
                <p className="text-4xl font-extrabold text-white mt-1">{formatUSD(producto.precio_cliente)}</p>
                {producto.moq && (
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>MOQ {producto.moq}</p>
                )}
              </div>
            )}

            <DestacadosRapidos
              colorVariante={producto.color_variante}
              dimensiones={producto.dimensiones}
              moq={producto.moq}
              cbmUnitario={producto.cbm_unitario}
              camposFicha={producto.ficha_tecnica?.campos}
              idioma="en"
            />

            {producto.descripcion && (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{producto.descripcion}</p>
            )}

            {/* Acciones — sticky en móvil */}
            <div
              className="fixed bottom-0 left-0 right-0 lg:static bg-white lg:bg-transparent p-4 lg:p-0 z-20 space-y-2 shadow-[0_-2px_8px_rgba(0,13,102,0.10)] lg:shadow-none"
            >
              {enCarrito > 0 && (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: 'var(--ep-success-bg)', color: 'var(--ep-success)' }}
                >
                  <CheckCircle2 size={13} /> In your order · {enCarrito}x
                </span>
              )}
              <div className="flex items-center gap-3">
                <QuantityStepper value={cantidad} onChange={v => setCantidad(Math.max(1, v))} size="md" min={1} />
                <button
                  onClick={agregar}
                  className="flex-1 h-[52px] rounded-xl font-bold text-white text-[15px] flex items-center justify-center gap-2 transition-colors hover:bg-[var(--ep-navy-hover)] active:bg-[var(--ep-navy-press)] active:scale-[0.98]"
                  style={{
                    background: estadoBoton === 'agregado' ? 'var(--ep-success)' : 'var(--ep-navy)',
                    boxShadow: '0 4px 12px rgba(0,13,102,0.25)',
                  }}
                >
                  {estadoBoton === 'agregado' ? (
                    <><CheckCircle2 size={16} /> Added</>
                  ) : enCarrito > 0 ? 'Update quantity' : 'Add to order'}
                </button>
              </div>
              {estadoBoton === 'error' && (
                <p className="text-xs font-medium" style={{ color: 'var(--ep-danger)' }}>
                  Couldn&apos;t add it, please try again
                </p>
              )}
            </div>

            <EspecificacionesPrincipales
              titulo="Key specifications"
              colorVariante={producto.color_variante}
              dimensiones={producto.dimensiones}
              moq={producto.moq}
              cbmUnitario={producto.cbm_unitario}
              camposFicha={producto.ficha_tecnica?.campos}
              idioma="en"
            />
          </div>
        </div>

        {/* Ficha técnica — solo si está aprobada y tiene contenido (gateado
            server-side por lib/catalogoPublico.ts, no se reinventa acá). */}
        {hayContenidoFicha && (
          <div className="rounded-2xl mt-6 mb-8 overflow-hidden border bg-white" style={{ borderColor: 'var(--ep-border)' }}>
            {/* Público: sin toggle ES/EN ni badge de estado (regla ya existente) */}
            <div className="h-12 px-4 flex items-center" style={{ background: 'var(--ep-navy)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide text-white">Product details</p>
            </div>
            <div className="p-4">
              {producto.descripcion_larga_en && (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line mb-3">{producto.descripcion_larga_en}</p>
              )}
              {hayFicha && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {producto.ficha_tecnica!.campos.map((c, i) => (
                    <div key={i} className="rounded-xl p-3 border" style={{ background: '#F8FAFC', borderColor: 'var(--ep-border)' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ep-navy)' }}>{c.label}</p>
                      <p className="text-xs font-medium text-gray-800">{c.valor}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <ProductosRelacionados
          productos={relacionados}
          hrefBuilder={id => `/solicitud/${params.token}/producto/${id}`}
          titulo="You might also like"
        />
      </div>
    </div>
  )
}
