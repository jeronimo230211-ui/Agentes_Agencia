'use client'
import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, RefreshCw, CheckCircle2, Download } from 'lucide-react'
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
  descripcion_corta_es?: string | null
  descripcion_corta_en?: string | null
  descripcion_larga_es?: string | null
  descripcion_larga_en?: string | null
  ficha_tecnica?: { campos: { label: string; valor: string; label_en?: string | null; valor_en?: string | null }[] } | null
}

type IdiomaFicha = 'es' | 'en'

function Skeleton() {
  return (
    <div className="min-h-screen bg-bg-page">
      <div className="max-w-5xl mx-auto px-4 py-6 animate-pulse">
        <div className="h-4 w-40 bg-bg-subtle rounded mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-[1.27fr_1fr] gap-8 lg:gap-10">
          <div className="h-80 md:h-[400px] lg:h-[440px] bg-bg-subtle rounded-2xl" />
          <div className="space-y-4">
            <div className="h-3 w-24 bg-bg-subtle rounded" />
            <div className="h-6 w-3/4 bg-bg-subtle rounded" />
            <div className="h-8 w-32 bg-bg-subtle rounded" />
            <div className="h-12 bg-bg-subtle rounded-lg" />
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
  // Jerónimo (2026-10-29): se revierte la decisión anterior de dejar esta
  // página fija en inglés -- la mayoría de clientes son internacionales así
  // que arranca en 'en', pero ahora sí se puede cambiar a español.
  const [idioma, setIdioma] = useState<IdiomaFicha>('en')

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
      // BUG-007: era background var(--ep-light) (fijo, sin variante oscura) +
      // bg-white/text-gray-* -- al heredar bg-page oscuro de layout.tsx en vez
      // de ese fijo, el texto gris oscuro fijo se volvía casi invisible.
      <div className="min-h-screen flex items-center justify-center p-4 bg-bg-page">
        <div className="bg-bg-surface rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-danger mx-auto mb-4" />
          <h1 className="text-xl font-bold text-text-heading mb-2">Invalid link</h1>
          <p className="text-text-muted text-sm">This order link is not valid. Please contact Europartners to get your correct link.</p>
        </div>
      </div>
    )
  }

  if (estado === 'error' || !producto) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-bg-page">
        <div className="bg-bg-surface rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={40} className="mb-3 mx-auto text-danger" />
          <p className="text-text-muted font-medium mb-4">We couldn&apos;t load this product</p>
          <button
            onClick={cargar}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-on-action-primary bg-action-primary hover:bg-action-primary-hover"
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
  // gate, siempre visible) que se muestra aparte más abajo. Se chequean los
  // dos idiomas (no solo el seleccionado) para no ocultar la sección si el
  // usuario todavía no cambió el toggle y el contenido solo existe en el
  // otro idioma.
  const hayContenidoFicha = hayFicha || !!producto.descripcion_larga_es || !!producto.descripcion_larga_en
  const enCarrito = cantidadDe(producto.id)
  const modelo = extraerModelo(producto.ficha_tecnica?.campos)
  const descripcionCorta = idioma === 'es' ? producto.descripcion_corta_es : producto.descripcion_corta_en
  const descripcionLarga = idioma === 'es' ? producto.descripcion_larga_es : producto.descripcion_larga_en
  // Tabla grande de specs (distinta del resumen de chips, que usa
  // lib/especificacionesPrincipales.ts): en ES usa label/valor tal cual; en
  // EN usa label_en/valor_en SOLO si ese campo puntual ya los tiene (los 15
  // productos con ficha cargada hoy los tienen completos, pero fichas
  // futuras podrían no estar traducidas aún) -- si falta la traducción se
  // omite ese campo individual, no toda la tabla.
  const camposFichaIdioma = (producto.ficha_tecnica?.campos ?? [])
    .map(c => (idioma === 'es'
      ? { label: c.label, valor: c.valor }
      : (c.label_en && c.valor_en) ? { label: c.label_en, valor: c.valor_en } : null))
    .filter((c): c is { label: string; valor: string } => c !== null)

  return (
    <div className="min-h-screen bg-bg-page">
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
                <p className="font-mono text-sm font-bold uppercase tracking-wide text-text-heading">{producto.codigo}</p>
                <h1 className="text-2xl lg:text-3xl font-extrabold text-text-heading leading-tight mt-0.5">{producto.nombre}</h1>
                <p className="text-xs text-text-muted mt-1">
                  {modelo ? `Model ${modelo} | Code ${producto.codigo}` : `Code: ${producto.codigo}`}
                </p>
              </div>
              <BotonFavorito productoId={producto.id} textoGuardar="Save" textoGuardado="Saved" />
            </div>

            {descripcionCorta && (
              <p className="text-sm font-semibold italic text-text-muted">{descripcionCorta}</p>
            )}

            {producto.precio_cliente != null && (
              <div
                className="rounded-2xl px-6 py-5"
                style={{ background: 'var(--bg-brand)', boxShadow: '0 4px 16px rgba(22,35,115,0.18)' }}
              >
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--cuarzo)' }}>Your Price</p>
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
              idioma={idioma}
            />

            {producto.descripcion && (
              <p className="text-sm text-text leading-relaxed whitespace-pre-line">{producto.descripcion}</p>
            )}

            {/* Acciones — sticky en móvil. BUG-007: era bg-white fijo. */}
            <div
              className="fixed bottom-0 left-0 right-0 lg:static bg-bg-surface lg:bg-transparent p-4 lg:p-0 z-20 space-y-2 shadow-[0_-2px_8px_rgba(22,35,115,0.10)] lg:shadow-none"
            >
              {enCarrito > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-success-bg text-success">
                  <CheckCircle2 size={13} /> In your order · {enCarrito}x
                </span>
              )}
              <div className="flex items-center gap-3">
                <QuantityStepper value={cantidad} onChange={v => setCantidad(Math.max(1, v))} size="md" min={1} />
                <button
                  onClick={agregar}
                  className={`flex-1 h-[52px] rounded-xl font-bold text-on-action-primary text-[15px] flex items-center justify-center gap-2 transition-colors active:scale-[0.98] ${
                    estadoBoton === 'agregado' ? 'bg-success' : 'bg-action-primary hover:bg-action-primary-hover'
                  }`}
                  style={{ boxShadow: '0 4px 12px rgba(22,35,115,0.25)' }}
                >
                  {estadoBoton === 'agregado' ? (
                    <><CheckCircle2 size={16} /> Added</>
                  ) : enCarrito > 0 ? 'Update quantity' : 'Add to order'}
                </button>
              </div>
              {estadoBoton === 'error' && (
                <p className="text-xs font-medium text-danger">
                  Couldn&apos;t add it, please try again
                </p>
              )}
            </div>

            <EspecificacionesPrincipales
              titulo={idioma === 'es' ? 'Especificaciones principales' : 'Key specifications'}
              colorVariante={producto.color_variante}
              dimensiones={producto.dimensiones}
              moq={producto.moq}
              cbmUnitario={producto.cbm_unitario}
              camposFicha={producto.ficha_tecnica?.campos}
              idioma={idioma}
            />
          </div>
        </div>

        {/* Ficha técnica — solo si está aprobada y tiene contenido (gateado
            server-side por lib/catalogoPublico.ts, no se reinventa acá). */}
        {hayContenidoFicha && (
          // BUG-007: era bg-white + borderColor var(--ep-border) (legacy, fijo).
          <div className="rounded-2xl mt-6 mb-8 overflow-hidden border border-border bg-bg-surface">
            {/* Toggle ES/EN reactivado por pedido de Jerónimo (2026-10-29) --
                mismo patrón visual (pill blanco sobre la barra de marca) que
                el toggle del catálogo interno (ver catalogo/[id]/page.tsx). */}
            {/* BUG-202: antes h-12 fijo forzaba los botones a quedar en ~25px
                de alto (menos del mínimo táctil de 44px) -- min-h-12 + py-2
                deja que la barra crezca para que el pill ES/EN quepa a 44px. */}
            <div className="min-h-12 py-2 px-4 flex items-center justify-between gap-2 flex-wrap bg-bg-brand">
              <p className="text-xs font-semibold uppercase tracking-wide text-white">
                {idioma === 'es' ? 'Detalles del producto' : 'Product details'}
              </p>
              <div className="flex rounded-full overflow-hidden text-[11px] font-semibold flex-shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <button
                  onClick={() => setIdioma('es')}
                  className="min-h-11 min-w-11 px-3 flex items-center justify-center transition-colors"
                  style={idioma === 'es' ? { background: '#fff', color: 'var(--bg-brand)' } : { color: '#fff' }}
                >ES</button>
                <button
                  onClick={() => setIdioma('en')}
                  className="min-h-11 min-w-11 px-3 flex items-center justify-center transition-colors"
                  style={idioma === 'en' ? { background: '#fff', color: 'var(--bg-brand)' } : { color: '#fff' }}
                >EN</button>
              </div>
            </div>
            <div className="p-4">
              {descripcionLarga && (
                <p className="text-sm text-text leading-relaxed whitespace-pre-line mb-3">{descripcionLarga}</p>
              )}
              {/* BUG-201 resuelto (2026-10-29): ficha_tecnica.campos ya trae
                  label_en/valor_en por campo -- ver camposFichaIdioma arriba,
                  que usa la traducción si existe y omite el campo puntual si
                  no (nunca toda la tabla). */}
              {camposFichaIdioma.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  {camposFichaIdioma.map((c, i) => (
                    <div key={i} className="rounded-xl p-3 border bg-bg-subtle border-border">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-heading">{c.label}</p>
                      <p className="text-xs font-medium text-text">{c.valor}</p>
                    </div>
                  ))}
                </div>
              )}
              {/* Descarga pública por token -- ver
                  app/api/productos/[id]/ficha-pdf-publica/route.ts. Distinto
                  del endpoint interno: acá nunca se puede ver un borrador, por
                  eso el botón solo aparece si hayContenidoFicha (gateado por
                  ficha_tecnica_estado === 'aprobada' en lib/catalogoPublico.ts). */}
              {/* BUG-202: caja de solo ~16px de alto (altura de línea de texto)
                  -- antes era un link subrayado; Jerónimo pidió que se vea como
                  un botón real. Es secundaria frente a "Add to order" (que ya
                  usa bg-action-primary relleno), así que va con borde y fondo
                  transparente para no competir visualmente con la acción
                  primaria de la pantalla. */}
              <a
                href={`/api/productos/${producto.id}/ficha-pdf-publica?token=${params.token}&idioma=${idioma}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl border border-border-strong bg-bg-surface text-xs font-semibold text-text-heading hover:bg-bg-subtle transition-colors"
              >
                <Download size={13} />
                {idioma === 'es' ? 'Descargar ficha técnica (PDF)' : 'Download technical data sheet (PDF)'}
              </a>
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
