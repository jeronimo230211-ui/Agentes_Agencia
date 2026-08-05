'use client'
import { useState, useMemo } from 'react'
import {
  Search, Package, Plus, Trash2, Loader2, AlertCircle,
  CheckCircle, ShoppingCart, X, Eye,
} from 'lucide-react'
import QuantityStepper from './QuantityStepper'
import ProductoDetalleModal from './ProductoDetalleModal'
import { formatUSD } from '@/lib/precio'

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
}

export interface LineaCarrito {
  key: string
  producto_id?: string
  descripcion_libre?: string
  codigo?: string
  nombre: string
  cantidad: number
}

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
  // al cliente correo/nombre/teléfono/dirección (opcional, con "Ahora no").
  contactoCompleto?: boolean
  onGuardarContacto?: (datos: { contacto_nombre: string; contacto_email: string; contacto_telefono: string; direccion: string }) => Promise<{ ok: boolean; error?: string }>
}

// Formulario compartido de pedido — usado por el link fijo de pedido
// (/solicitud/[token]) y por el link de edición tras una devolución
// (/solicitud-editar/[token]). El estado loading/invalid de la carga inicial
// lo maneja cada página wrapper; este componente solo controla el armado y
// envío del carrito.
export default function SolicitudForm({
  clienteNombre, categorias, productos, carritoInicial = [], notasInicial = '',
  banner, subtitulo = 'Nuevo pedido', tituloExito = '¡Solicitud enviada!',
  mensajeExito, textoBoton = 'Enviar solicitud a Europartners', onEnviar,
  contactoCompleto = true, onGuardarContacto,
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
  const [carrito, setCarrito] = useState<LineaCarrito[]>(carritoInicial)
  const [notasCliente, setNotasCliente] = useState(notasInicial)
  const [showCarrito, setShowCarrito] = useState(false)
  const [descLibre, setDescLibre] = useState('')
  const [productoDetalle, setProductoDetalle] = useState<Producto | null>(null)

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

  // Fija la cantidad absoluta de un producto en el carrito (no la suma) —
  // cantidad <= 0 lo quita, si no existe lo crea, si ya existe la actualiza.
  function setCantidadProducto(p: Producto, cantidad: number) {
    setCarrito(prev => {
      const existente = prev.find(l => l.producto_id === p.id)
      if (cantidad <= 0) {
        return prev.filter(l => l.producto_id !== p.id)
      }
      if (existente) {
        return prev.map(l => l.producto_id === p.id ? { ...l, cantidad } : l)
      }
      return [...prev, { key: p.id, producto_id: p.id, codigo: p.codigo, nombre: p.nombre, cantidad }]
    })
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
      setError(err || 'Error al enviar la solicitud')
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
    else setErrorContacto(err || 'No se pudo guardar, intenta de nuevo')
  }

  const totalItems = carrito.reduce((s, l) => s + l.cantidad, 0)

  if (estado === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{tituloExito}</h1>
          <p className="text-gray-500">
            {mensajeExito
              ? mensajeExito(totalItems)
              : `Recibimos tu pedido con ${totalItems} artículo${totalItems !== 1 ? 's' : ''}. Europartners lo revisará y te enviará la proforma comercial pronto.`}
          </p>

          {pedirContacto && (
            <div className="mt-6 pt-6 border-t border-gray-100 text-left">
              <p className="text-sm font-semibold text-gray-700 mb-1">¿A qué correo te enviamos la proforma?</p>
              <p className="text-xs text-gray-400 mb-3">
                Nos ayuda a mandarte toda la información de tu pedido al correo correcto. Puedes omitir esto y dárnoslo después.
              </p>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Nombre de contacto"
                  value={contactoNombre}
                  onChange={e => setContactoNombre(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
                />
                <input
                  type="email"
                  placeholder="Correo *"
                  value={contactoEmail}
                  onChange={e => setContactoEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
                />
                <input
                  type="text"
                  placeholder="Teléfono"
                  value={contactoTelefono}
                  onChange={e => setContactoTelefono(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
                />
                <input
                  type="text"
                  placeholder="Dirección de envío/entrega"
                  value={contactoDireccion}
                  onChange={e => setContactoDireccion(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
                />
              </div>
              {errorContacto && <p className="text-xs text-red-500 mt-2">{errorContacto}</p>}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setPedirContacto(false)}
                  className="flex-1 text-sm font-semibold py-2.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                >
                  Ahora no
                </button>
                <button
                  onClick={guardarContacto}
                  disabled={!contactoEmail.trim() || guardandoContacto}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold py-2.5 rounded-lg text-white disabled:opacity-40"
                  style={{ background: '#1E3A5F' }}
                >
                  {guardandoContacto && <Loader2 size={14} className="animate-spin" />}
                  Guardar
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Error</h1>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => setEstado('form')}
            className="px-5 py-2 rounded-lg font-medium text-white"
            style={{ background: '#1E3A5F' }}
          >
            Volver al pedido
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 py-5 sticky top-0 z-10 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#D4A017]">Europartners</h1>
            <p className="text-sm opacity-75">{subtitulo} · {clienteNombre}</p>
          </div>
          <button
            onClick={() => setShowCarrito(true)}
            className="relative flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-semibold"
          >
            <ShoppingCart size={18} />
            Mi pedido
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#D4A017] text-[#1E3A5F] text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-5">
        {banner && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex gap-3">
            <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-1">Europartners necesita confirmar algo de tu pedido</p>
              <p className="text-sm text-amber-700">{banner}</p>
            </div>
          </div>
        )}

        {/* Buscador + categorías */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar producto..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
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

        {/* Grid de productos */}
        {productosFiltrados.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p>No se encontraron productos</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            {productosFiltrados.map(p => {
              const enCarrito = carrito.find(l => l.producto_id === p.id)
              const cantidad = enCarrito?.cantidad || 0
              return (
                <div
                  key={p.id}
                  onClick={() => setProductoDetalle(p)}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col cursor-pointer hover:shadow-md hover:border-gray-200 transition-all group"
                >
                  <div className="relative bg-gray-50 h-32 flex items-center justify-center overflow-hidden">
                    {p.imagen_url ? (
                      <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-contain p-2" />
                    ) : (
                      <Package size={28} className="text-gray-300" />
                    )}
                    <div className="absolute top-1.5 right-1.5 bg-white/90 rounded-full p-1.5 shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Eye size={13} className="text-[#1E3A5F]" />
                    </div>
                  </div>
                  <div className="p-3 flex flex-col gap-1 flex-1">
                    <p className="font-mono text-xs font-bold text-[#1E3A5F]">{p.codigo}</p>
                    <p className="text-sm text-gray-800 font-medium leading-tight line-clamp-2 flex-1">{p.nombre}</p>
                    {p.precio_cliente != null && (
                      <p className="text-sm font-bold" style={{ color: '#D4A017' }}>{formatUSD(p.precio_cliente)}</p>
                    )}
                    {cantidad > 0 ? (
                      <div className="mt-2 flex justify-center">
                        <QuantityStepper value={cantidad} onChange={v => setCantidadProducto(p, v)} />
                      </div>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); agregarProducto(p) }}
                        className="mt-2 text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors text-white"
                        style={{ background: '#1E3A5F' }}
                      >
                        <Plus size={13} />
                        Agregar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* No lo encuentro */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-8">
          <p className="text-sm font-semibold text-gray-700 mb-2">¿No encuentras lo que buscas?</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Describe el producto..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
              value={descLibre}
              onChange={e => setDescLibre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && agregarLibre()}
            />
            <button
              onClick={agregarLibre}
              disabled={!descLibre.trim()}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: '#1E3A5F' }}
            >
              Agregar
            </button>
          </div>
        </div>
      </div>

      {/* Barra inferior fija cuando hay items */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4 z-20">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <p className="text-sm text-gray-600">
              <strong>{totalItems}</strong> artículo{totalItems !== 1 ? 's' : ''} en tu pedido
            </p>
            <button
              onClick={() => setShowCarrito(true)}
              className="px-5 py-2.5 rounded-lg font-bold text-sm"
              style={{ background: '#D4A017', color: '#1E3A5F' }}
            >
              Revisar y enviar →
            </button>
          </div>
        </div>
      )}

      {/* Modal carrito */}
      {showCarrito && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Tu pedido</h2>
              <button onClick={() => setShowCarrito(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {carrito.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Aún no has agregado productos</p>
              ) : (
                <div className="space-y-3 mb-5">
                  {carrito.map(l => (
                    <div key={l.key} className="flex items-center gap-3 border-b border-gray-50 pb-3">
                      <div className="flex-1 min-w-0">
                        {l.codigo && <p className="font-mono text-xs text-gray-400">{l.codigo}</p>}
                        <p className="text-sm text-gray-800 font-medium truncate">{l.nombre}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <QuantityStepper value={l.cantidad} onChange={v => fijarCantidadCarrito(l.key, v)} />
                        <button onClick={() => quitar(l.key)} className="text-red-400 hover:text-red-600 ml-1">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <label className="text-xs font-semibold text-gray-500 uppercase">Notas para Europartners (opcional)</label>
              <textarea
                value={notasCliente}
                onChange={e => setNotasCliente(e.target.value)}
                placeholder="Ej: necesito el pedido antes del 30 de agosto..."
                className="w-full mt-1.5 border border-gray-200 rounded-lg p-3 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
              />
            </div>

            <div className="p-5 border-t border-gray-100">
              <button
                onClick={enviar}
                disabled={carrito.length === 0 || estado === 'sending'}
                className="w-full py-3 rounded-lg font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: '#1E3A5F' }}
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
