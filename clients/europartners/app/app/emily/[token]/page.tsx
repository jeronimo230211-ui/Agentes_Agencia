'use client'
import { useState, useEffect, useMemo } from 'react'
import { Loader2, AlertCircle, CheckCircle, Package, Search, HelpCircle, X } from 'lucide-react'

const ONBOARDING_KEY = 'emily_onboarding_dismissed_v1'

interface Categoria { id: string; nombre: string }
interface Producto {
  id: string
  categoria_id: string | null
  codigo: string
  nombre: string
  imagen_url: string | null
  precio_fob_usd: number | null
}
interface Fila { cantidad: string; precio: string }

// Página pública para Emily (proveedor en China) — módulo aparte del resto
// del sistema, ver migración 017. Sin login (mismo mecanismo que
// /solicitud/[token] de los clientes) para minimizar fricción de acceso
// desde China con VPN. Solo ve las categorías que se le hayan asignado.
export default function EmilyPage({ params }: { params: { token: string } }) {
  const [estado, setEstado] = useState<'loading' | 'invalid' | 'form' | 'sending' | 'done' | 'error'>('loading')
  const [nombre, setNombre] = useState('')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [categoriaId, setCategoriaId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filas, setFilas] = useState<Record<string, Fila>>({})
  const [notas, setNotas] = useState('')
  const [error, setError] = useState('')
  const [mostrarOnboarding, setMostrarOnboarding] = useState(false)

  useEffect(() => {
    fetch(`/api/emily/${params.token}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) {
          setEstado('invalid')
        } else {
          setNombre(json.nombre)
          setCategorias(json.categorias || [])
          setProductos(json.productos || [])
          setEstado('form')
        }
      })
      .catch(() => setEstado('invalid'))
  }, [params.token])

  useEffect(() => {
    if (estado !== 'form') return
    try {
      if (!window.localStorage.getItem(ONBOARDING_KEY)) setMostrarOnboarding(true)
    } catch {
      setMostrarOnboarding(true)
    }
  }, [estado])

  function cerrarOnboarding() {
    setMostrarOnboarding(false)
    try { window.localStorage.setItem(ONBOARDING_KEY, '1') } catch {}
  }

  const productosFiltrados = useMemo(() => {
    let list = productos
    if (categoriaId) list = list.filter(p => p.categoria_id === categoriaId)
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase()
      list = list.filter(p => p.codigo.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q))
    }
    return list
  }, [productos, categoriaId, busqueda])

  function setFila(id: string, campo: keyof Fila, valor: string) {
    setFilas(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }))
  }

  const lineasListas = useMemo(() => {
    return Object.entries(filas)
      .map(([producto_id, f]) => ({
        producto_id,
        cantidad: Number(f.cantidad),
        precio_fob_propuesto: Number(f.precio),
      }))
      .filter(l => l.cantidad > 0 && l.precio_fob_propuesto > 0)
  }, [filas])

  async function enviar() {
    if (lineasListas.length === 0) return
    setEstado('sending')
    const res = await fetch(`/api/emily/${params.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineas: lineasListas, notas: notas.trim() || null }),
    })
    if (res.ok) {
      setEstado('done')
    } else {
      const j = await res.json()
      setError(j.error || 'Error sending')
      setEstado('error')
    }
  }

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
          <h1 className="text-xl font-bold text-gray-800 mb-2">Invalid link</h1>
          <p className="text-gray-500 text-sm">This link is not valid. Please contact Europartners.</p>
        </div>
      </div>
    )
  }

  if (estado === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Sent!</h1>
          <p className="text-gray-500">
            Europartners received your pricing with {lineasListas.length} item{lineasListas.length !== 1 ? 's' : ''}
            and will review it soon.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-[#1E3A5F] text-white px-4 py-5 sticky top-0 z-10 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#D4A017]">Europartners</h1>
            <p className="text-sm opacity-75">Supplier pricing · {nombre}</p>
          </div>
          <button
            onClick={() => setMostrarOnboarding(true)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg flex-shrink-0"
          >
            <HelpCircle size={14} />
            How it works
          </button>
        </div>
      </div>

      {mostrarOnboarding && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Welcome, {nombre}</h2>
              <button onClick={cerrarOnboarding} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm text-gray-600">
              <p>This is your private pricing link with Europartners. It only shows two product
                categories for now: <strong>Toilets</strong> and <strong>Pedestal Washbasins</strong>.</p>
              <div>
                <p className="font-semibold text-gray-800 mb-1">1. Quote the products you want</p>
                <p>For any product, enter the <strong>Qty</strong> and <strong>Your FOB price</strong> in
                  USD. You don&apos;t need to fill in every product — only the ones you&apos;re quoting
                  right now.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">2. &quot;Current cost&quot; is just a reference</p>
                <p>It&apos;s the price Europartners has on file today. It won&apos;t change until your
                  new price is reviewed and approved.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">3. Send it</p>
                <p>Click <strong>Send to Europartners</strong> at the bottom of the page. You can come
                  back to this same link anytime to send new prices.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">4. Europartners reviews it</p>
                <p>Your quote is not final until Europartners approves it — this replaces the price
                  list you normally send by email, it doesn&apos;t change anything else about how you
                  work with them.</p>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100">
              <button
                onClick={cerrarOnboarding}
                className="w-full py-3 rounded-lg font-bold text-white"
                style={{ background: '#1E3A5F' }}
              >
                Got it, let&apos;s start
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 pt-5">
        {estado === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex gap-3">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <p className="text-sm text-gray-500 mb-4">
          Enter quantity and your FOB price for the products you want to quote. Only rows with both
          fields filled will be sent.
        </p>

        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search product..."
              className="w-full pl-9 pr-4 py-2 text-base border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
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
              All
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

        {productosFiltrados.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p>No products found</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto mb-8">
            <div className="hidden sm:grid sm:grid-cols-[auto_1fr_100px_90px_110px] gap-3 px-4 py-2.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
              <span></span>
              <span>Product</span>
              <span>Current cost</span>
              <span>Qty</span>
              <span>Your FOB $</span>
            </div>
            {productosFiltrados.map(p => {
              const fila = filas[p.id] || { cantidad: '', precio: '' }
              const activa = fila.cantidad !== '' || fila.precio !== ''
              return (
                <div
                  key={p.id}
                  className={`border-t border-gray-50 ${activa ? 'bg-amber-50/40' : ''}`}
                >
                  {/* Mobile: card apilada */}
                  <div className="sm:hidden px-4 py-3">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {p.imagen_url ? (
                          <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-contain" />
                        ) : (
                          <Package size={16} className="text-gray-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs font-bold text-[#1E3A5F]">{p.codigo}</p>
                        <p className="text-sm text-gray-700">{p.nombre}</p>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {p.precio_fob_usd != null ? `$${p.precio_fob_usd.toFixed(2)}` : '—'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Qty</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1"
                          value={fila.cantidad}
                          onChange={e => setFila(p.id, 'cantidad', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                        />
                      </label>
                      <label className="block">
                        <span className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Your FOB $</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={fila.precio}
                          onChange={e => setFila(p.id, 'precio', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Desktop/tablet: grid original */}
                  <div className="hidden sm:grid sm:grid-cols-[auto_1fr_100px_90px_110px] gap-3 px-4 py-2.5 items-center">
                    <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {p.imagen_url ? (
                        <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-contain" />
                      ) : (
                        <Package size={14} className="text-gray-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-[#1E3A5F]">{p.codigo}</p>
                      <p className="text-sm text-gray-700 truncate">{p.nombre}</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {p.precio_fob_usd != null ? `$${p.precio_fob_usd.toFixed(2)}` : '—'}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={fila.cantidad}
                      onChange={e => setFila(p.id, 'cantidad', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={fila.precio}
                      onChange={e => setFila(p.id, 'precio', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <label className="text-xs font-semibold text-gray-500 uppercase">Notes (optional)</label>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          placeholder="E.g.: prices valid until..."
          className="w-full mt-1.5 border border-gray-200 rounded-lg p-3 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 mb-8"
        />
      </div>

      {lineasListas.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4 z-20">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <p className="text-sm text-gray-600">
              <strong>{lineasListas.length}</strong> item{lineasListas.length !== 1 ? 's' : ''} ready to send
            </p>
            <button
              onClick={enviar}
              disabled={estado === 'sending'}
              className="px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50"
              style={{ background: '#D4A017', color: '#1E3A5F' }}
            >
              {estado === 'sending' && <Loader2 size={14} className="animate-spin" />}
              Send to Europartners →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
