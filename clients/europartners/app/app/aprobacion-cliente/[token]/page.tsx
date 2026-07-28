'use client'
import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react'
import { formatUSD } from '@/lib/precio'
import type { Proforma } from '@/types/europartners'

// Página pública — el cliente la accede desde el link del email sin hacer login.
// No muestra costo ni margen: esas columnas son internas.
export default function AprobacionClientePage({ params }: { params: { token: string } }) {
  const [proforma, setProforma] = useState<Proforma | null>(null)
  const [estado, setEstado] = useState<'loading' | 'valid' | 'invalid' | 'processing' | 'done' | 'error'>('loading')
  const [resultado, setResultado] = useState<'aprobada' | 'cambios' | null>(null)
  const [comentario, setComentario] = useState('')
  const [showCambios, setShowCambios] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function validarToken() {
      const res = await fetch(`/api/aprobacion-cliente?token=${params.token}`)
      const json = await res.json()
      if (json.error) {
        setEstado('invalid')
      } else {
        setProforma(json.proforma)
        setEstado('valid')
      }
    }
    validarToken()
  }, [params.token])

  async function aprobar() {
    setEstado('processing')
    const res = await fetch(`/api/aprobacion-cliente`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token, accion: 'aprobar' }),
    })
    if (res.ok) {
      setResultado('aprobada')
      setEstado('done')
    } else {
      const j = await res.json()
      setError(j.error || 'Something went wrong')
      setEstado('error')
    }
  }

  async function pedirCambios() {
    if (!comentario.trim()) return
    setEstado('processing')
    const res = await fetch(`/api/aprobacion-cliente`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token, accion: 'rechazar', comentario }),
    })
    if (res.ok) {
      setResultado('cambios')
      setEstado('done')
    } else {
      const j = await res.json()
      setError(j.error || 'Something went wrong')
      setEstado('error')
    }
  }

  if (estado === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-ep-navy" size={40} />
      </div>
    )
  }

  if (estado === 'invalid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Link invalid or expired</h1>
          <p className="text-gray-500 text-sm">
            This link was already used or has expired (valid for 7 days).
            Please contact us and we&apos;ll send you a new one.
          </p>
        </div>
      </div>
    )
  }

  if (estado === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          {resultado === 'aprobada' ? (
            <>
              <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Proforma approved!</h1>
              <p className="text-gray-500">
                Thank you. You will shortly receive the final invoice for proforma{' '}
                <strong>{proforma?.numero}</strong> with payment instructions.
              </p>
            </>
          ) : (
            <>
              <XCircle size={56} className="text-amber-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Changes requested</h1>
              <p className="text-gray-500">
                Thank you, we received your comments. Our team will review them and send you an
                updated proforma.
              </p>
            </>
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
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  const cliente = proforma?.cliente
  const lineas = proforma?.lineas || []
  const total = proforma?.total_cif_usd || proforma?.total_fob_usd || 0

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-[#1E3A5F] text-white rounded-t-xl p-5">
          <h1 className="text-xl font-bold text-[#D4A017]">Europartners International</h1>
          <p className="text-sm opacity-75">Proforma Review</p>
        </div>

        <div className="bg-white rounded-b-xl shadow-lg p-6 mb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-[#1E3A5F]">{proforma?.numero}</h2>
              <p className="text-gray-500">{cliente?.nombre} · {proforma?.incoterm}</p>
              <p className="text-sm text-gray-400">{proforma?.fecha}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total {proforma?.incoterm}</p>
              <p className="text-2xl font-bold text-[#1E3A5F]">{formatUSD(total)}</p>
            </div>
          </div>

          {/* Tabla de líneas — sin costo ni margen, esas columnas son internas */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1E3A5F] text-white">
                  <th className="p-2 text-left">Description</th>
                  <th className="p-2 text-center">Qty</th>
                  <th className="p-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={l.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-2">
                      <div>{l.descripcion_pdf}</div>
                      <div className="text-xs text-gray-400">{l.codigo_pdf}</div>
                    </td>
                    <td className="p-2 text-center">{l.cantidad}</td>
                    <td className="p-2 text-right font-medium">{formatUSD(l.precio_cliente_usd || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Botones de acción */}
          {!showCambios ? (
            <div className="flex gap-3">
              <button
                onClick={aprobar}
                disabled={estado === 'processing'}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {estado === 'processing' ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                APPROVE
              </button>
              <button
                onClick={() => setShowCambios(true)}
                className="px-5 py-3 border-2 border-amber-200 text-amber-600 rounded-lg font-medium hover:bg-amber-50"
              >
                Request Changes
              </button>
            </div>
          ) : (
            <div className="border-2 border-amber-100 rounded-lg p-4">
              <h3 className="font-bold text-gray-700 mb-2">What would you like us to change?</h3>
              <textarea
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                placeholder="Tell us what needs to be adjusted..."
                className="w-full border rounded-lg p-3 text-sm mb-3 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <div className="flex gap-2">
                <button
                  onClick={pedirCambios}
                  disabled={!comentario.trim() || estado === 'processing'}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg font-bold disabled:opacity-50"
                >
                  Send Request
                </button>
                <button
                  onClick={() => setShowCambios(false)}
                  className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
