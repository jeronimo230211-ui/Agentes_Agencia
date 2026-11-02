'use client'
import { useEffect, useState } from 'react'
import { X, Loader2, Search } from 'lucide-react'

interface ProductoOpcion {
  id: string
  codigo: string
  nombre: string
  descripcion?: string | null
}

export default function FijarPrecioEspecialModal({
  clienteId,
  codigo,
  productoId,
  precioSugerido,
  onClose,
  onGuardado,
}: {
  clienteId: string
  codigo: string
  productoId?: string
  precioSugerido?: number
  onClose: () => void
  onGuardado: (precioUsd: number) => void
}) {
  const [precio, setPrecio] = useState(precioSugerido != null ? String(precioSugerido) : '')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Fallback cuando no hay producto_id de la línea y el match automático por
  // codigo_pdf falla — pasa en proformas importadas de Excel, cuyo código de
  // línea usa la nomenclatura del proveedor y no coincide con productos.codigo
  // (caso HK... KM-460R, Deisy 2026-09-02). En vez de dejarla trabada con "el
  // producto no existe", se le deja buscar y vincular el producto real.
  const [productoManual, setProductoManual] = useState<ProductoOpcion | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<ProductoOpcion[]>([])
  const [noEncontrado, setNoEncontrado] = useState(false)

  useEffect(() => {
    if (!noEncontrado) return
    setBuscando(true)
    const t = setTimeout(() => {
      const params = new URLSearchParams({ limit: '15' })
      if (busqueda) params.set('q', busqueda)
      fetch(`/api/productos?${params}`)
        .then(r => r.json())
        .then(({ data }) => { setResultados(data || []); setBuscando(false) })
        .catch(() => setBuscando(false))
    }, 300)
    return () => clearTimeout(t)
  }, [noEncontrado, busqueda])

  async function guardar() {
    const precioNum = parseFloat(precio)
    if (!precioNum || precioNum <= 0) { setError('Ingresa un precio válido'); return }

    setGuardando(true)
    setError('')
    const res = await fetch(`/api/clientes/${clienteId}/precios-especiales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // producto_id (de la línea, o el elegido a mano abajo) es la fuente
        // de verdad. `codigo` es codigo_pdf, un texto congelado al armar la
        // proforma que puede no coincidir carácter a carácter con
        // productos.codigo (import de Excel, edición posterior, etc.) —
        // depender de ese match rompía "Fijar precio especial" con un falso
        // "el producto no existe".
        producto_id: productoManual?.id ?? productoId,
        codigo,
        precio_usd: precioNum,
        motivo: motivo.trim() || undefined,
      }),
    })
    setGuardando(false)

    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      if (res.status === 404 && !productoManual) {
        setNoEncontrado(true)
        // codigo_pdf suele traer el modelo al inicio y separadores tipo
        // "--(" o "(" antes del detalle de color/medida — ese primer tramo
        // es el que más chance tiene de aparecer también en productos.codigo.
        setBusqueda(codigo.split(/--|\(/)[0].trim())
      }
      setError(j.error || 'No se pudo guardar')
      return
    }
    onGuardado(precioNum)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      {/* BUG-007: era bg-white fijo. */}
      <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold font-display text-text-heading">Fijar precio especial</h3>
          <button onClick={onClose} className="text-text-subtle hover:text-text"><X size={18} /></button>
        </div>
        <p className="text-xs text-text-subtle font-mono mb-1">{codigo}</p>
        <p className="text-xs text-text-subtle mb-4">
          Este precio reemplaza al de catálogo solo para este cliente, en este producto — no afecta a nadie más.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-muted block mb-1">Precio especial (USD)</label>
            <input
              type="number" step="0.01" autoFocus
              value={precio} onChange={e => setPrecio(e.target.value)}
              placeholder="0.00"
              className="bg-bg-surface w-full border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Motivo (opcional)</label>
            <input
              type="text"
              value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: precio negociado histórico, ver proforma #045"
              className="bg-bg-surface w-full border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}

          {noEncontrado && (
            // BUG-0XX: eran colores Tailwind fijos (amber-*/gray-*) que no reaccionan
            // a data-theme="dark" -- se veía como una isla clara flotando en el modal
            // oscuro. Tokens semánticos de warning/texto, igual que en solicitudes y
            // cotizador para el mismo tipo de aviso.
            <div className="border border-warning bg-warning-bg rounded-lg p-3">
              {productoManual ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs">
                    <p className="text-text-subtle">Producto vinculado a mano:</p>
                    <p className="font-medium text-text-heading">{productoManual.codigo} — {productoManual.nombre}</p>
                  </div>
                  <button
                    onClick={() => setProductoManual(null)}
                    className="text-xs text-text-subtle hover:text-red-500 flex-shrink-0"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-warning font-medium mb-2">
                    No coincide con ningún código del catálogo. Busca el producto correcto:
                  </p>
                  <div className="relative mb-2">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle" />
                    <input
                      type="text"
                      value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                      placeholder="Código o descripción..."
                      className="w-full border border-border rounded-lg pl-7 pr-2 py-1.5 text-xs text-text focus:outline-none focus:ring-1 focus:ring-focus-ring bg-bg-surface"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {buscando ? (
                      <div className="py-3 text-center"><Loader2 size={14} className="animate-spin mx-auto text-text-subtle" /></div>
                    ) : resultados.length === 0 ? (
                      <p className="text-xs text-text-subtle text-center py-2">Sin resultados</p>
                    ) : (
                      resultados.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setProductoManual(p)}
                          className="w-full text-left px-2 py-1.5 rounded-md hover:bg-bg-surface text-xs"
                        >
                          <span className="font-mono text-text-subtle">{p.codigo}</span>{' — '}
                          <span className="text-text">{p.nombre}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-border text-sm text-text-muted hover:bg-bg-subtle"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando || (noEncontrado && !productoManual)}
            className="flex-1 py-2 rounded-lg bg-action-primary text-on-action-primary text-sm font-semibold hover:bg-action-primary-hover disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {guardando ? <Loader2 size={14} className="animate-spin" /> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
