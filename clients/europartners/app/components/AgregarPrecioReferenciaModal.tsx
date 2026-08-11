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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-[#1E3A5F]">Agregar precio de referencia</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-400 font-mono mb-4">{codigo}</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Precio dado al cliente (USD)</label>
            <input
              type="number" step="0.01" autoFocus
              value={precio} onChange={e => setPrecio(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Fecha</label>
            <input
              type="date"
              value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Referencia (opcional)</label>
            <input
              type="text"
              value={referencia} onChange={e => setReferencia(e.target.value)}
              placeholder="Ej: proforma vieja #045, factura en PDF"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex-1 py-2 rounded-lg bg-[#1E3A5F] text-white text-sm font-semibold hover:bg-[#16304d] disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {guardando ? <Loader2 size={14} className="animate-spin" /> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
