'use client'
import { useState, useMemo, useEffect } from 'react'
import Image from 'next/image'
import {
  Search, Package, Plus, Trash2, Loader2, AlertCircle,
  CheckCircle, ShoppingCart, X, Eye,
} from 'lucide-react'
import QuantityStepper from './QuantityStepper'
import ProductoDetalleModal from './ProductoDetalleModal'
import Paginacion from './Paginacion'
import { formatUSD } from '@/lib/precio'
import { fijarCantidadProducto, type LineaCarrito } from '@/lib/carrito'

// Mismo tamaño de página que el catálogo interno -- la grilla pública se
// sentía "scroll infinito" (Jerónimo la comparó mal contra Amazon/Homecenter)
// porque mostraba TODOS los productos filtrados de una. Acá el catálogo
// completo ya llega de una sola vez desde el padre (getCatalogoPublico no
// pagina -- el cliente necesita poder buscar en todo para armar su pedido),
// así que el corte de página es puramente de render sobre el resultado ya
// filtrado: no toca el fetch ni el carrito.
const TAMANO_PAGINA = 30

interface Categoria { id: string; nombre: string }
interface Producto {
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
  precio_cliente?: number | null
  descripcion_larga_en?: string | null
  ficha_tecnica?: { campos: { label: string; valor: string }[] } | null
}

// Reexportado por compatibilidad — quien ya hacía `import { LineaCarrito }
// from '@/components/SolicitudForm'` (solicitud-editar) sigue funcionando.
// La definición real vive en lib/carrito.ts para poder compartirla con la
// página de detalle de producto (app/solicitud/[token]/producto/[id]) y el
// contexto de carrito (lib/SolicitudCarritoContext.tsx).
export type { LineaCarrito }

interface Props {
  clienteNombre: string
  categorias: Categoria[]
  productos: Producto[]
  carritoInicial?: LineaCarrito[]
  notasInicial?: string
  banner?: string
  subtitulo?: string
  tituloExito?: string
  mensajeExito?: (totalItems: number) => string
  textoBoton?: string
  onEnviar: (payload: { lineas: { producto_id?: string; descripcion_libre?: string; cantidad: number }[]; notas_cliente: string | null }) => Promise<{ ok: boolean; error?: string }>
  // Si se pasa y contactoCompleto es false, tras enviar el pedido se le pide
  // al cliente correo/nombre/teléfono/dirección (opcional, con "Not now").
  contactoCompleto?: boolean
  onGuardarContacto?: (datos: { contacto_nombre: string; contacto_email: string; contacto_telefono: string; direccion: string }) => Promise<{ ok: boolean; error?: string }>
  // Carrito controlado desde afuera (usado por /solicitud/[token]/page.tsx,
  // que lo guarda en SolicitudCarritoContext para que sobreviva la
  // navegación a la página de detalle de producto). Si no se pasa, el
  // carrito vive en estado local como siempre (caso de solicitud-editar).
  carrito?: LineaCarrito[]
  onCarritoChange?: (actualizar: (prev: LineaCarrito[]) => LineaCarrito[]) => void
  // Si se pasa, un click en una tarjeta navega a la página de detalle del
  // producto en vez de abrir el modal viejo (ver ProductoDetalleModal).
  onVerProducto?: (p: Producto) => void
}

// Formulario compartido de pedido — usado por el link fijo de pedido
// (/solicitud/[token]) y por el link de edición tras una devolución
// (/solicitud-editar/[token]). El estado loading/invalid de la carga inicial
// lo maneja cada página wrapper; este componente solo controla el armado y
// envío del carrito. Todo el texto visible es en inglés (clientes son
// mayormente angloparlantes) — decisión explícita de Jero, 2026-08-05.
//
// Colores: los botones "Add" de la grilla y "Review and send" de la barra
// inferior usan bg-brand (ultramar) porque son acciones repetidas/de
// navegación -- el único bg-action-primary (indigo) de toda esta pantalla
// es el envío real del pedido dentro del modal de carrito (botón
// `textoBoton`), que es la acción primaria de la vista (regla del manual de
// marca: un solo indigo por pantalla).
export default function SolicitudForm({
  clienteNombre, categorias, productos, carritoInicial = [], notasInicial = '',
  banner, subtitulo = 'New order', tituloExito = 'Order submitted!',
  mensajeExito, textoBoton = 'Send order to Europartners', onEnviar,
  contactoCompleto = true, onGuardarContacto,
  carrito: carritoControlado, onCarritoChange, onVerProducto,
}: Props) {
  const [estado, setEstado] = useState<'form' | 'sending' | 'done' | 'error'>('form')
  const [pedirContacto, setPedirContacto] = useState(false)
  const [contactoNombre, setContactoNombre] = useState('')
  const [contactoEmail, setContactoEmail] = useState('')
  const [contactoTelefono, setContactoTelefono] = useState('')
  const [contactoDireccion, setContactoDireccion] = useState('')
  const [guardandoContacto, setGuardandoContacto] = useState(false)
  const [errorContacto, setErrorContacto] = useState('')
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [carritoInterno, setCarritoInterno] = useState<LineaCarrito[]>(carritoInicial)
  const [notasCliente, setNotasCliente] = useState(notasInicial)
  const [showCarrito, setShowCarrito] = useState(false)
  const [descLibre, setDescLibre] = useState('')
  const [productoDetalle, setProductoDetalle] = useState<Producto | null>(null)
  const [pagina, setPagina] = useState(1)

  // Modo controlado/no controlado: si el padre pasa `carrito` + `onCarritoChange`
  // (ver SolicitudCarritoProvider), esos ganan; si no, se usa el estado local
  // de siempre. Así solicitud-editar sigue funcionando sin tocarla.
  const carrito = carritoControlado ?? carritoInterno
  function setCarrito(actualizar: (prev: LineaCarrito[]) => LineaCarrito[]) {
    if (onCarritoChange) onCarritoChange(actualizar)
    else setCarritoInterno(actualizar)
  }

  const productosFiltrados = useMemo(() => {
    let list = productos
    if (categoriaId) list = list.filter(p => p.categoria_id === categoriaId)
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase()
      list = list.filter(p =>
        p.codigo.toLowerCase().includes(q) ||
        p.nombre.toLowerCase().includes(q) ||
        (p.descripcion || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [productos, categoriaId, busqueda])

  // Vuelve a la página 1 cada vez que cambia el filtro (no cuando solo
  // cambia de página) -- si no, buscar algo nuevo mientras estás en la
  // página 3 mostraría "No products found" aunque sí haya resultados en la
  // página 1 de esa búsqueda.
  useEffect(() => { setPagina(1) }, [busqueda, categoriaId])

  const totalPaginasProductos = Math.max(1, Math.ceil(productosFiltrados.length / TAMANO_PAGINA))
  const productosPagina = useMemo(
    () => productosFiltrados.slice((pagina - 1) * TAMANO_PAGINA, pagina * TAMANO_PAGINA),
    [productosFiltrados, pagina]
  )

  // Fija la cantidad absoluta de un producto en el carrito (no la suma) —
  // misma regla que usa la página de detalle de producto (lib/carrito.ts),
  // para que agregar desde la grilla o desde el detalle sea idéntico.
  function setCantidadProducto(p: Producto, cantidad: number) {
    setCarrito(prev => fijarCantidadProducto(prev, p, cantidad))
  }

  function agregarProducto(p: Producto) {
    const existente = carrito.find(l => l.producto_id === p.id)
    setCantidadProducto(p, (existente?.cantidad || 0) + 1)
  }

  function agregarLibre() {
    if (!descLibre.trim()) return
    setCarrito(prev => [...prev, {
      key: `libre-${Date.now()}`,
      descripcion_libre: descLibre.trim(),
      nombre: descLibre.trim(),
      cantidad: 1,
    }])
    setDescLibre('')
  }

  function fijarCantidadCarrito(key: string, cantidad: number) {
    setCarrito(prev => prev
      .map(l => l.key === key ? { ...l, cantidad } : l)
      .filter(l => l.cantidad > 0)
    )
  }

  function quitar(key: string) {
    setCarrito(prev => prev.filter(l => l.key !== key))
  }

  async function enviar() {
    if (carrito.length === 0) return
    setEstado('sending')
    const { ok, error: err } = await onEnviar({
      notas_cliente: notasCliente.trim() || null,
      lineas: carrito.map(l => ({
        producto_id: l.producto_id,
        descripcion_libre: l.descripcion_libre,
        cantidad: l.cantidad,
      })),
    })
    if (ok) {
      setEstado('done')
      if (onGuardarContacto && !contactoCompleto) setPedirContacto(true)
    } else {
      setError(err || 'Error sending the order')
      setEstado('error')
    }
  }

  async function guardarContacto() {
    if (!contactoEmail.trim() || !onGuardarContacto) return
    setGuardandoContacto(true)
    setErrorContacto('')
    const { ok, error: err } = await onGuardarContacto({
      contacto_nombre: contactoNombre.trim(),
      contacto_email: contactoEmail.trim(),
      contacto_telefono: contactoTelefono.trim(),
      direccion: contactoDireccion.trim(),
    })
    setGuardandoContacto(false)
    if (ok) setPedirContacto(false)
    else setErrorContacto(err || 'Could not save, please try again')
  }

  const totalItems = carrito.reduce((s, l) => s + l.cantidad, 0)
  const totalPedido = carrito.reduce((s, l) => s + (l.precio_cliente != null ? l.precio_cliente * l.cantidad : 0), 0)
  const hayItemsSinPrecio = carrito.some(l => l.precio_cliente == null)

  if (estado === 'done') {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
        <div className="bg-bg-surface rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle size={56} className="text-success mx-auto mb-4" />
          <h1 className="font-display heading-2 text-text-heading mb-2">{tituloExito}</h1>
          <p className="text-text-muted">
            {mensajeExito
              ? mensajeExito(totalItems)
              : `We received your order with ${totalItems} item${totalItems !== 1 ? 's' : ''}. Europartners will review it and send you the commercial proforma soon.`}
          </p>

          {pedirContacto && (
            <div className="mt-6 pt-6 border-t border-border text-left">
              <p className="text-sm font-semibold text-text mb-1">What email should we send your proforma to?</p>
              <p className="text-caption text-text-subtle mb-3">
                This helps us send all your order information to the right email. You can skip this and give it to us later.
              </p>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Contact name"
                  value={contactoNombre}
                  onChange={e => setContactoNombre(e.target.value)}
                  className="w-full border border-border-control rounded-sm px-3 py-2 text-body bg-bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
                />
                <input
                  type="email"
                  placeholder="Email *"
                  value={contactoEmail}
                  onChange={e => setContactoEmail(e.target.value)}
                  className="w-full border border-border-control rounded-sm px-3 py-2 text-body bg-bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
                />
                <input
                  type="text"
                  placeholder="Phone"
                  value={contactoTelefono}
                  onChange={e => setContactoTelefono(e.target.value)}
                  className="w-full border border-border-control rounded-sm px-3 py-2 text-body bg-bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
                />
                <input
                  type="text"
                  placeholder="Shipping/delivery address"
                  value={contactoDireccion}
                  onChange={e => setContactoDireccion(e.target.value)}
                  className="w-full border border-border-control rounded-sm px-3 py-2 text-body bg-bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
                />
              </div>
              {errorContacto && <p className="text-caption text-danger mt-2">{errorContacto}</p>}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setPedirContacto(false)}
                  className="flex-1 text-button h-control-md rounded-sm border border-border-control text-text-muted hover:bg-bg-subtle"
                >
                  Not now
                </button>
                <button
                  onClick={guardarContacto}
                  disabled={!contactoEmail.trim() || guardandoContacto}
                  className="flex-1 flex items-center justify-center gap-1.5 text-button h-control-md rounded-sm bg-action-primary hover:bg-action-primary-hover text-on-action-primary disabled:opacity-40"
                >
                  {guardandoContacto && <Loader2 size={14} className="animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (estado === 'error') {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
        <div className="bg-bg-surface rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-danger mx-auto mb-4" />
          <h1 className="font-display heading-3 text-text-heading mb-2">Error</h1>
          <p className="text-text-muted mb-4">{error}</p>
          <button
            onClick={() => setEstado('form')}
            className="px-5 h-control-md rounded-sm text-button bg-action-primary hover:bg-action-primary-hover text-on-action-primary"
          >
            Back to order
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-page pb-24">
      {/* Header */}
      <div className="bg-bg-brand text-text-on-brand px-4 py-5 sticky top-0 z-sticky shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            {/* Logo real — variante blanca del sistema de Marta (mismo
                patrón que (auth)/login). */}
            <Image src="/brand/europartners-horizontal-blanco.svg" alt="Europartners" width={147} height={26} priority />
            <p className="text-body-sm opacity-75 mt-1">{subtitulo} · {clienteNombre}</p>
          </div>
          <button
            onClick={() => setShowCarrito(true)}
            className="relative flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-sm text-button"
          >
            <ShoppingCart size={18} />
            My order
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-bg-accent text-on-accent text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-5">
        {banner && (
          <div className="bg-warning-bg border border-warning rounded-md p-4 mb-5 flex gap-3">
            <AlertCircle size={20} className="text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning mb-1">Europartners needs to confirm something about your order</p>
              <p className="text-body-sm text-warning">{banner}</p>
            </div>
          </div>
        )}

        {/* Buscador + categorías */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input
              type="text"
              placeholder="Search product..."
              className="w-full pl-9 pr-4 h-control-md text-body border border-border-control rounded-sm bg-bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCategoriaId('')}
              className={`text-label px-3 py-1.5 rounded-pill transition-colors ${
                !categoriaId ? 'bg-bg-accent text-on-accent' : 'bg-bg-subtle text-text-muted hover:bg-border'
              }`}
            >
              All
            </button>
            {categorias.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategoriaId(prev => prev === cat.id ? '' : cat.id)}
                className={`text-label px-3 py-1.5 rounded-pill transition-colors ${
                  categoriaId === cat.id ? 'bg-bg-accent text-on-accent' : 'bg-bg-subtle text-text-muted hover:bg-border'
                }`}
              >
                {cat.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de productos */}
        {productosFiltrados.length === 0 ? (
          <div className="text-center py-16 text-text-subtle">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p>No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-2">
            {productosPagina.map(p => {
              const enCarrito = carrito.find(l => l.producto_id === p.id)
              const cantidad = enCarrito?.cantidad || 0
              return (
                <div
                  key={p.id}
                  onClick={() => onVerProducto ? onVerProducto(p) : setProductoDetalle(p)}
                  className="bg-bg-surface rounded-md border border-border shadow-sm overflow-hidden flex flex-col cursor-pointer hover:shadow-md hover:border-border-strong transition-all group"
                >
                  <div className="relative bg-bg-subtle h-32 flex items-center justify-center overflow-hidden">
                    {p.imagen_url ? (
                      <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-contain p-2" />
                    ) : (
                      <Package size={28} className="text-text-subtle" />
                    )}
                    <div className="absolute top-1.5 right-1.5 bg-bg-surface/90 rounded-full p-1.5 shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Eye size={13} className="text-text-heading" />
                    </div>
                  </div>
                  <div className="p-3 flex flex-col gap-1 flex-1">
                    <p className="text-code text-text-heading">{p.codigo}</p>
                    <p className="text-sm text-text font-medium leading-tight line-clamp-2 flex-1">{p.nombre}</p>
                    {p.precio_cliente != null && (
                      <p className="text-sm font-bold text-text-heading" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatUSD(p.precio_cliente)}</p>
                    )}
                    {cantidad > 0 ? (
                      <div className="mt-2 flex justify-center">
                        <QuantityStepper value={cantidad} onChange={v => setCantidadProducto(p, v)} />
                      </div>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); agregarProducto(p) }}
                        className="mt-2 text-button py-2 rounded-sm flex items-center justify-center gap-1.5 transition-colors bg-bg-brand text-text-on-brand"
                      >
                        <Plus size={13} />
                        Add
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {productosFiltrados.length > 0 && (
          <Paginacion
            pagina={pagina}
            totalPaginas={totalPaginasProductos}
            onCambiar={setPagina}
            textoAnterior="Previous"
            textoSiguiente="Next"
            textoPagina={(p, t) => `Page ${p} of ${t}`}
          />
        )}
        <div className="mb-6" />

        {/* No lo encuentro */}
        <div className="bg-bg-surface rounded-md border border-border p-4 mb-8">
          <p className="text-sm font-semibold text-text mb-2">Can&apos;t find what you&apos;re looking for?</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Describe the product..."
              className="flex-1 px-3 h-control-md text-body border border-border-control rounded-sm bg-bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
              value={descLibre}
              onChange={e => setDescLibre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && agregarLibre()}
            />
            <button
              onClick={agregarLibre}
              disabled={!descLibre.trim()}
              className="px-4 h-control-md rounded-sm text-button bg-bg-brand text-text-on-brand disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Barra inferior fija cuando hay items */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-bg-surface border-t border-border shadow-lg p-4 z-sticky">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <p className="text-text-muted text-body-sm">
              <strong className="text-text">{totalItems}</strong> item{totalItems !== 1 ? 's' : ''} in your order
              {totalPedido > 0 && (
                <> · <strong className="text-text-heading" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatUSD(totalPedido)}</strong>{hayItemsSinPrecio ? '+' : ''}</>
              )}
            </p>
            <button
              onClick={() => setShowCarrito(true)}
              className="px-5 h-control-md rounded-sm text-button bg-bg-brand text-text-on-brand"
            >
              Review and send →
            </button>
          </div>
        </div>
      )}

      {/* Modal carrito */}
      {showCarrito && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-modal p-0 sm:p-4">
          <div className="bg-bg-surface rounded-t-lg sm:rounded-lg shadow-lg w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-display heading-3 text-text-heading">Your order</h2>
              <button onClick={() => setShowCarrito(false)} className="text-text-subtle hover:text-text">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {carrito.length === 0 ? (
                <p className="text-text-subtle text-sm text-center py-8">You haven&apos;t added any products yet</p>
              ) : (
                <div className="space-y-3 mb-5">
                  {carrito.map(l => (
                    <div key={l.key} className="flex items-center gap-3 border-b border-border pb-3">
                      <div className="flex-1 min-w-0">
                        {l.codigo && <p className="text-code text-text-subtle">{l.codigo}</p>}
                        <p className="text-sm text-text font-medium truncate">{l.nombre}</p>
                        <p className="text-text-subtle text-body-sm">
                          {l.precio_cliente != null
                            ? <>{formatUSD(l.precio_cliente)} × {l.cantidad} = <strong className="text-text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatUSD(l.precio_cliente * l.cantidad)}</strong></>
                            : 'Price to be confirmed'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <QuantityStepper value={l.cantidad} onChange={v => fijarCantidadCarrito(l.key, v)} />
                        <button onClick={() => quitar(l.key)} className="text-danger hover:opacity-80 ml-1">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-sm font-semibold text-text">
                      {hayItemsSinPrecio ? 'Estimated total' : 'Total'}
                    </p>
                    <p className="text-lg font-bold text-text-heading" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatUSD(totalPedido)}</p>
                  </div>
                  {hayItemsSinPrecio && (
                    <p className="text-caption text-text-subtle -mt-2">
                      Some items don&apos;t have a listed price yet — Europartners will confirm it in your proforma.
                    </p>
                  )}
                </div>
              )}

              <label className="text-label text-text-muted uppercase">Notes for Europartners (optional)</label>
              <textarea
                value={notasCliente}
                onChange={e => setNotasCliente(e.target.value)}
                placeholder="E.g.: I need the order before August 30..."
                className="w-full mt-1.5 border border-border-control rounded-sm p-3 text-body h-20 resize-none bg-bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
              />
            </div>

            <div className="p-5 border-t border-border">
              <button
                onClick={enviar}
                disabled={carrito.length === 0 || estado === 'sending'}
                className="w-full h-control-lg rounded-sm text-button bg-action-primary hover:bg-action-primary-hover text-on-action-primary disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {estado === 'sending' ? <Loader2 className="animate-spin" size={18} /> : null}
                {textoBoton}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalle de producto */}
      {productoDetalle && (
        <ProductoDetalleModal
          producto={productoDetalle}
          cantidadActual={carrito.find(l => l.producto_id === productoDetalle.id)?.cantidad || 0}
          onConfirmar={cantidad => {
            setCantidadProducto(productoDetalle, cantidad)
            setProductoDetalle(null)
          }}
          onClose={() => setProductoDetalle(null)}
        />
      )}
    </div>
  )
}
