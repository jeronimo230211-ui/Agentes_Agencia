'use client'
import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'

export default function AgregarPrecioReferenciaModal({
  clienteId,
  codigo,
  onClose,
  onGuardado,
}: {
  clienteId: string
  codigo: string
  onClose: () => void
  onGuardado: () => void
}) {
  const [precio, setPrecio] = useState('')
  const [fecha, setFecha] = useState('')
  const [referencia, setReferencia] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    const precioNum = parseFloat(precio)
    if (!precioNum || precioNum <= 0) { setError('Ingresa un precio válido'); return }
    if (!fecha) { setError('Selecciona una fecha'); return }

    setGuardando(true)
    setError('')
    const res = await fetch('/api/historial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id: clienteId,
        codigo_pdf: codigo,
        precio_cliente_usd: precioNum,
        fecha_proforma: fecha,
        proforma_numero: referencia.trim() || undefined,
      }),
    })
    setGuardando(false)

    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'No se pudo guardar')
      return
    }
    onGuardado()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold font-display text-text-heading">Agregar precio de referencia</h3>
          <button onClick={onClose} className="text-text-subtle hover:text-text-muted"><X size={18} /></button>
        </div>
        <p className="text-xs text-text-subtle font-mono mb-4">{codigo}</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-muted block mb-1">Precio dado al cliente (USD)</label>
            <input
              type="number" step="0.01" autoFocus
              value={precio} onChange={e => setPrecio(e.target.value)}
              placeholder="0.00"
              className="bg-bg-surface w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Fecha</label>
            <input
              type="date"
              value={fecha} onChange={e => setFecha(e.target.value)}
              className="bg-bg-surface w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Referencia (opcional)</label>
            <input
              type="text"
              value={referencia} onChange={e => setReferencia(e.target.value)}
              placeholder="Ej: proforma vieja #045, factura en PDF"
              className="bg-bg-surface w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
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
            disabled={guardando}
            className="flex-1 py-2 rounded-lg bg-action-primary text-on-action-primary text-sm font-semibold hover:bg-action-primary-hover disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {guardando ? <Loader2 size={14} className="animate-spin" /> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
