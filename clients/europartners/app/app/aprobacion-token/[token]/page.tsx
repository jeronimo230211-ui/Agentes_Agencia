'use client'
import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react'
import { formatUSD, formatPct } from '@/lib/precio'
import type { Proforma } from '@/types/europartners'

// Esta página es pública — Marta la accede desde el link del email sin hacer login
export default function AprobacionTokenPage({ params }: { params: { token: string } }) {
  const [proforma, setProforma] = useState<Proforma | null>(null)
  const [estado, setEstado] = useState<'loading' | 'valid' | 'invalid' | 'processing' | 'done' | 'error'>('loading')
  const [resultado, setResultado] = useState<'aprobada' | 'rechazada' | null>(null)
  const [motivo, setMotivo] = useState('')
  const [showRechazo, setShowRechazo] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function validarToken() {
      const res = await fetch(`/api/aprobacion-token?token=${params.token}`)
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
    const res = await fetch(`/api/aprobacion-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token, accion: 'aprobar' }),
    })
    if (res.ok) {
      setResultado('aprobada')
      setEstado('done')
    } else {
      const j = await res.json()
      setError(j.error || 'Error al aprobar')
      setEstado('error')
    }
  }

  async function rechazar() {
    if (!motivo.trim()) return
    setEstado('processing')
    const res = await fetch(`/api/aprobacion-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token, accion: 'rechazar', motivo }),
    })
    if (res.ok) {
      setResultado('rechazada')
      setEstado('done')
    } else {
      const j = await res.json()
      setError(j.error || 'Error al rechazar')
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
          <h1 className="text-xl font-bold text-gray-800 mb-2">Enlace inválido o expirado</h1>
          <p className="text-gray-500 text-sm">
            Este enlace ya fue usado o ha expirado (válido por 7 días).
            Solicita a Deisy que reenvíe la proforma para obtener un nuevo enlace.
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
              <h1 className="text-2xl font-bold text-gray-800 mb-2">¡Proforma aprobada!</h1>
              <p className="text-gray-500">
                La proforma <strong>{proforma?.numero}</strong> ha sido aprobada.
                Deisy recibirá una notificación para enviarla al cliente.
              </p>
            </>
          ) : (
            <>
              <XCircle size={56} className="text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Proforma rechazada</h1>
              <p className="text-gray-500">
                Deisy recibirá tu comentario y podrá corregir y reenviar.
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
          <h1 className="text-xl font-bold text-[#D4A017]">Europartners</h1>
          <p className="text-sm opacity-75">Revisión de Proforma</p>
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

          {/* Tabla de líneas */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1E3A5F] text-white">
                  <th className="p-2 text-left">Descripción</th>
                  <th className="p-2 text-center">Qty</th>
                  <th className="p-2 text-right">Costo</th>
                  <th className="p-2 text-right">Precio</th>
                  <th className="p-2 text-right">Margen</th>
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
                    <td className="p-2 text-right text-gray-500">{formatUSD(l.precio_costo_usd || 0)}</td>
                    <td className="p-2 text-right font-medium">{formatUSD(l.precio_cliente_usd || 0)}</td>
                    <td className={`p-2 text-right font-medium ${(l.margen_pct || 0) < 0.10 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatPct(l.margen_pct || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Botones de acción */}
          {!showRechazo ? (
            <div className="flex gap-3">
              <button
                onClick={aprobar}
                disabled={estado === 'processing'}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {estado === 'processing' ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                APROBAR PROFORMA
              </button>
              <button
                onClick={() => setShowRechazo(true)}
                className="px-5 py-3 border-2 border-red-200 text-red-600 rounded-lg font-medium hover:bg-red-50"
              >
                Rechazar
              </button>
            </div>
          ) : (
            <div className="border-2 border-red-100 rounded-lg p-4">
              <h3 className="font-bold text-gray-700 mb-2">Motivo de rechazo</h3>
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Indica qué debe corregir Deisy..."
                className="w-full border rounded-lg p-3 text-sm mb-3 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <div className="flex gap-2">
                <button
                  onClick={rechazar}
                  disabled={!motivo.trim() || estado === 'processing'}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-bold disabled:opacity-50"
                >
                  Confirmar Rechazo
                </button>
                <button
                  onClick={() => setShowRechazo(false)}
                  className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
