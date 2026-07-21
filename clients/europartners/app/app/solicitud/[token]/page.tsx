'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  Search, Package, Plus, Minus, Trash2, Loader2, AlertCircle,
  CheckCircle, ShoppingCart, X,
} from 'lucide-react'

interface Categoria { id: string; nombre: string }
interface Producto {
  id: string
  categoria_id: string | null
  codigo: string
  nombre: string
  descripcion: string | null
  imagen_url: string | null
}

interface LineaCarrito {
  key: string
  producto_id?: string
  descripcion_libre?: string
  codigo?: string
  nombre: string
  cantidad: number
}

// Página pública — el cliente entra desde su link fijo de pedido, sin login.
export default function SolicitudPage({ params }: { params: { token: string } }) {
  const [estado, setEstado] = useState<'loading' | 'invalid' | 'form' | 'sending' | 'done' | 'error'>('loading')
  const [error, setError] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [carrito, setCarrito] = useState<LineaCarrito[]>([])
  const [notasCliente, setNotasCliente] = useState('')
  const [showCarrito, setShowCarrito] = useState(false)
  const [descLibre, setDescLibre] = useState('')

  useEffect(() => {
    fetch(`/api/solicitud/${params.token}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) {
          setEstado('invalid')
        } else {
          setClienteNombre(json.cliente.nombre)
          setCategorias(json.categorias || [])
          setProductos(json.productos || [])
          setEstado('form')
        }
      })
      .catch(() => setEstado('invalid'))
  }, [params.token])

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

  function agregarProducto(p: Producto) {
    setCarrito(prev => {
      const existente = prev.find(l => l.producto_id === p.id)
      if (existente) {
        return prev.map(l => l.producto_id === p.id ? { ...l, cantidad: l.cantidad + 1 } : l)
      }
      return [...prev, { key: p.id, producto_id: p.id, codigo: p.codigo, nombre: p.nombre, cantidad: 1 }]
    })
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

  function cambiarCantidad(key: string, delta: number) {
    setCarrito(prev => prev
      .map(l => l.key === key ? { ...l, cantidad: l.cantidad + delta } : l)
      .filter(l => l.cantidad > 0)
    )
  }

  function quitar(key: string) {
    setCarrito(prev => prev.filter(l => l.key !== key))
  }

  async function enviarSolicitud() {
    if (carrito.length === 0) return
    setEstado('sending')
    const res = await fetch(`/api/solicitud/${params.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notas_cliente: notasCliente.trim() || null,
        lineas: carrito.map(l => ({
          producto_id: l.producto_id,
          descripcion_libre: l.descripcion_libre,
          cantidad: l.cantidad,
        })),
      }),
    })
    if (res.ok) {
      setEstado('done')
    } else {
      const j = await res.json()
      setError(j.error || 'Error al enviar la solicitud')
      setEstado('error')
    }
  }

  const totalItems = carrito.reduce((s, l) => s + l.cantidad, 0)

  if (estado === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-[#1E3A5F]" size={40} />
      </div>
    )
  }

  if (estado === 'invalid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Enlace inválido</h1>
          <p className="text-gray-500 text-sm">
            Este enlace de pedido no es válido. Contacta a Europartners para obtener tu link correcto.
          </p>
        </div>
      </div>
    )
  }

  if (estado === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">¡Solicitud enviada!</h1>
          <p className="text-gray-500">
            Recibimos tu pedido con {totalItems} artículo{totalItems !== 1 ? 's' : ''}.
            Europartners lo revisará y te enviará la proforma comercial pronto.
          </p>
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
            <p className="text-sm opacity-75">Nuevo pedido · {clienteNombre}</p>
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
              return (
                <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="relative bg-gray-50 h-32 flex items-center justify-center overflow-hidden">
                    {p.imagen_url ? (
                      <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-contain p-2" />
                    ) : (
                      <Package size={28} className="text-gray-300" />
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-1 flex-1">
                    <p className="font-mono text-xs font-bold text-[#1E3A5F]">{p.codigo}</p>
                    <p className="text-sm text-gray-800 font-medium leading-tight line-clamp-2 flex-1">{p.nombre}</p>
                    <button
                      onClick={() => agregarProducto(p)}
                      className={`mt-2 text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                        enCarrito ? 'bg-green-50 text-green-700' : 'text-white'
                      }`}
                      style={!enCarrito ? { background: '#1E3A5F' } : {}}
                    >
                      <Plus size={13} />
                      {enCarrito ? `En pedido (${enCarrito.cantidad})` : 'Agregar'}
                    </button>
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
                        <button onClick={() => cambiarCantidad(l.key, -1)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
                          <Minus size={13} />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{l.cantidad}</span>
                        <button onClick={() => cambiarCantidad(l.key, 1)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
                          <Plus size={13} />
                        </button>
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
                onClick={enviarSolicitud}
                disabled={carrito.length === 0 || estado === 'sending'}
                className="w-full py-3 rounded-lg font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: '#1E3A5F' }}
              >
                {estado === 'sending' ? <Loader2 className="animate-spin" size={18} /> : null}
                Enviar solicitud a Europartners
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
