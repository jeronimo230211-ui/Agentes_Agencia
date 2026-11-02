'use client'
import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
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
      <div className="min-h-screen bg-bg-page flex items-center justify-center">
        <Loader2 className="animate-spin text-action-primary" size={40} />
      </div>
    )
  }

  if (estado === 'invalid') {
    return (
      // BUG-011: el logo solo se agregaba al estado válido de esta pantalla --
      // un token vencido/inexistente mostraba solo la tarjeta de error, sin marca.
      // Mismo header bg-bg-brand + logo blanco que usan aprobacion-cliente,
      // aprobacion-token y pago para su estado inválido.
      <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-bg-brand text-text-on-brand rounded-t-lg p-5">
            <Image src="/brand/europartners-horizontal-blanco.svg" alt="Europartners" width={147} height={26} priority />
          </div>
          <div className="bg-bg-surface rounded-b-lg shadow-lg p-8 text-center">
            <AlertCircle size={48} className="text-danger mx-auto mb-4" />
            <h1 className="font-display heading-3 text-text-heading mb-2">Invalid link</h1>
            <p className="text-text-muted text-body">This link is not valid. Please contact Europartners.</p>
          </div>
        </div>
      </div>
    )
  }

  if (estado === 'done') {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
        <div className="bg-bg-surface rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle size={56} className="text-success mx-auto mb-4" />
          <h1 className="font-display heading-2 text-text-heading mb-2">Sent!</h1>
          <p className="text-text-muted">
            Europartners received your pricing with {lineasListas.length} item{lineasListas.length !== 1 ? 's' : ''}
            and will review it soon.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-page pb-28">
      <div className="bg-bg-brand text-text-on-brand px-4 py-5 sticky top-0 z-10 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            {/* Logo real — variante blanca del sistema de Marta (mismo
                patrón que (auth)/login). */}
            <Image src="/brand/europartners-horizontal-blanco.svg" alt="Europartners" width={147} height={26} priority />
            <p className="text-body-sm opacity-75 mt-1">Supplier pricing · {nombre}</p>
          </div>
          <button
            onClick={() => setMostrarOnboarding(true)}
            className="flex items-center gap-1.5 text-label bg-white/10 hover:bg-white/20 px-3 py-2 rounded-sm flex-shrink-0"
          >
            <HelpCircle size={14} />
            How it works
          </button>
        </div>
      </div>

      {mostrarOnboarding && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-modal p-0 sm:p-4">
          <div className="bg-bg-surface rounded-t-lg sm:rounded-lg shadow-lg w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-display heading-3 text-text-heading">Welcome, {nombre}</h2>
              <button onClick={cerrarOnboarding} className="text-text-subtle hover:text-text">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-body text-text-muted">
              <p>This is your private pricing link with Europartners. It only shows two product
                categories for now: <strong className="text-text">Toilets</strong> and <strong className="text-text">Pedestal Washbasins</strong>.</p>
              <div>
                <p className="font-semibold text-text mb-1">1. Quote the products you want</p>
                <p>For any product, enter the <strong className="text-text">Qty</strong> and <strong className="text-text">Your FOB price</strong> in
                  USD. You don&apos;t need to fill in every product — only the ones you&apos;re quoting
                  right now.</p>
              </div>
              <div>
                <p className="font-semibold text-text mb-1">2. &quot;Current cost&quot; is just a reference</p>
                <p>It&apos;s the price Europartners has on file today. It won&apos;t change until your
                  new price is reviewed and approved.</p>
              </div>
              <div>
                <p className="font-semibold text-text mb-1">3. Send it</p>
                <p>Click <strong className="text-text">Send to Europartners</strong> at the bottom of the page. You can come
                  back to this same link anytime to send new prices.</p>
              </div>
              <div>
                <p className="font-semibold text-text mb-1">4. Europartners reviews it</p>
                <p>Your quote is not final until Europartners approves it — this replaces the price
                  list you normally send by email, it doesn&apos;t change anything else about how you
                  work with them.</p>
              </div>
            </div>
            <div className="p-5 border-t border-border">
              <button
                onClick={cerrarOnboarding}
                className="w-full h-control-lg rounded-sm text-button bg-action-primary hover:bg-action-primary-hover text-on-action-primary"
              >
                Got it, let&apos;s start
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 pt-5">
        {estado === 'error' && (
          <div className="bg-danger-bg border border-danger rounded-md p-4 mb-5 flex gap-3">
            <AlertCircle size={18} className="text-danger flex-shrink-0 mt-0.5" />
            <p className="text-danger text-body-sm">{error}</p>
          </div>
        )}

        <p className="text-text-muted text-body-sm mb-4">
          Enter quantity and your FOB price for the products you want to quote. Only rows with both
          fields filled will be sent.
        </p>

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

        {productosFiltrados.length === 0 ? (
          <div className="text-center py-16 text-text-subtle">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p>No products found</p>
          </div>
        ) : (
          <div className="bg-bg-surface rounded-md border border-border overflow-x-auto mb-8">
            <div className="hidden sm:grid sm:grid-cols-[auto_1fr_100px_90px_110px] gap-3 px-4 py-2.5 bg-bg-subtle text-label text-text-muted uppercase">
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
                  className={`border-t border-border ${activa ? 'bg-bg-selected' : ''}`}
                >
                  {/* Mobile: card apilada */}
                  <div className="sm:hidden px-4 py-3">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-md bg-bg-subtle flex items-center justify-center overflow-hidden flex-shrink-0">
                        {p.imagen_url ? (
                          <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-contain" />
                        ) : (
                          <Package size={16} className="text-text-subtle" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-code text-text-heading">{p.codigo}</p>
                        <p className="text-body text-text">{p.nombre}</p>
                      </div>
                      <span className="text-text-subtle text-body-sm flex-shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {p.precio_fob_usd != null ? `$${p.precio_fob_usd.toFixed(2)}` : '—'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="block text-label text-text-muted mb-1">Qty</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1"
                          value={fila.cantidad}
                          onChange={e => setFila(p.id, 'cantidad', e.target.value)}
                          className="w-full border border-border-control rounded-sm px-3 py-2.5 text-body bg-bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
                        />
                      </label>
                      <label className="block">
                        <span className="block text-label text-text-muted mb-1">Your FOB $</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={fila.precio}
                          onChange={e => setFila(p.id, 'precio', e.target.value)}
                          className="w-full border border-border-control rounded-sm px-3 py-2.5 text-body bg-bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Desktop/tablet: grid original */}
                  <div className="hidden sm:grid sm:grid-cols-[auto_1fr_100px_90px_110px] gap-3 px-4 py-2.5 items-center">
                    <div className="w-9 h-9 rounded-md bg-bg-subtle flex items-center justify-center overflow-hidden flex-shrink-0">
                      {p.imagen_url ? (
                        <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-contain" />
                      ) : (
                        <Package size={14} className="text-text-subtle" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-code text-text-heading">{p.codigo}</p>
                      <p className="text-body text-text truncate">{p.nombre}</p>
                    </div>
                    <span className="text-text-subtle text-body-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {p.precio_fob_usd != null ? `$${p.precio_fob_usd.toFixed(2)}` : '—'}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={fila.cantidad}
                      onChange={e => setFila(p.id, 'cantidad', e.target.value)}
                      className="w-full border border-border-control rounded-sm px-2 py-1.5 text-body-sm bg-bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={fila.precio}
                      onChange={e => setFila(p.id, 'precio', e.target.value)}
                      className="w-full border border-border-control rounded-sm px-2 py-1.5 text-body-sm bg-bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <label className="text-label text-text-muted uppercase">Notes (optional)</label>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          placeholder="E.g.: prices valid until..."
          className="w-full mt-1.5 border border-border-control rounded-sm p-3 text-body h-20 resize-none bg-bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus-ring mb-8"
        />
      </div>

      {lineasListas.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-bg-surface border-t border-border shadow-lg p-4 z-sticky">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <p className="text-text-muted text-body-sm">
              <strong className="text-text">{lineasListas.length}</strong> item{lineasListas.length !== 1 ? 's' : ''} ready to send
            </p>
            <button
              onClick={enviar}
              disabled={estado === 'sending'}
              className="px-5 h-control-md rounded-sm text-button bg-action-primary hover:bg-action-primary-hover text-on-action-primary flex items-center gap-2 disabled:opacity-50"
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
