'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
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
      <div className="min-h-screen bg-bg-page flex items-center justify-center">
        <Loader2 className="animate-spin text-action-primary" size={40} />
      </div>
    )
  }

  if (estado === 'invalid') {
    return (
      // BUG-011: el logo solo se agregaba al estado válido -- un token
      // inválido/expirado mostraba solo la tarjeta de error, sin marca.
      <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-bg-brand text-text-on-brand rounded-t-lg p-5">
            <Image src="/brand/europartners-horizontal-blanco.svg" alt="Europartners" width={147} height={26} priority />
          </div>
          <div className="bg-bg-surface rounded-b-lg shadow-lg p-8 text-center">
            <AlertCircle size={48} className="text-danger mx-auto mb-4" />
            <h1 className="font-display heading-3 text-text-heading mb-2">Link invalid or expired</h1>
            <p className="text-text-muted text-body">
              This link was already used or has expired (valid for 7 days).
              Please contact us and we&apos;ll send you a new one.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (estado === 'done') {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
        <div className="bg-bg-surface rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          {resultado === 'aprobada' ? (
            <>
              <CheckCircle size={56} className="text-success mx-auto mb-4" />
              <h1 className="font-display heading-2 text-text-heading mb-2">Proforma approved!</h1>
              <p className="text-text-muted">
                Thank you. You will shortly receive the final invoice for proforma{' '}
                <strong className="text-code text-text">{proforma?.numero}</strong> with payment instructions.
              </p>
            </>
          ) : (
            <>
              <XCircle size={56} className="text-warning mx-auto mb-4" />
              <h1 className="font-display heading-2 text-text-heading mb-2">Changes requested</h1>
              <p className="text-text-muted">
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
      <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
        <div className="bg-bg-surface rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-danger mx-auto mb-4" />
          <h1 className="font-display heading-3 text-text-heading mb-2">Error</h1>
          <p className="text-text-muted">{error}</p>
        </div>
      </div>
    )
  }

  const cliente = proforma?.cliente
  const lineas = proforma?.lineas || []
  const total = proforma?.total_cif_usd || proforma?.total_fob_usd || 0

  return (
    <div className="min-h-screen bg-bg-page p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-bg-brand text-text-on-brand rounded-t-lg p-5">
          {/* Logo real — variante blanca del sistema de Marta, se lee directo
              sobre el fondo de marca (mismo patrón que (auth)/login). */}
          <Image src="/brand/europartners-horizontal-blanco.svg" alt="Europartners" width={147} height={26} priority />
          <p className="text-body-sm opacity-75 mt-1">Proforma Review</p>
        </div>

        <div className="bg-bg-surface rounded-b-lg shadow-lg p-6 mb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="font-display heading-2 text-text-heading">{proforma?.numero}</h2>
              <p className="text-text-muted">{cliente?.nombre} · {proforma?.incoterm}</p>
              <p className="text-text-subtle text-body-sm">{proforma?.fecha}</p>
            </div>
            <div className="text-right">
              <p className="text-text-muted text-body-sm">Total {proforma?.incoterm}</p>
              <p className="font-display figure-lg text-text-heading" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatUSD(total)}</p>
            </div>
          </div>

          {/* Tabla de líneas — sin costo ni margen, esas columnas son internas */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-body">
              <thead>
                <tr className="bg-bg-brand text-text-on-brand">
                  <th className="p-2 text-left">Description</th>
                  <th className="p-2 text-center">Qty</th>
                  <th className="p-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={l.id} className={i % 2 === 0 ? 'bg-bg-surface' : 'bg-bg-subtle'}>
                    <td className="p-2">
                      <div className="text-text">{l.descripcion_pdf}</div>
                      <div className="text-code text-text-subtle">{l.codigo_pdf}</div>
                    </td>
                    <td className="p-2 text-center text-text">{l.cantidad}</td>
                    <td className="p-2 text-right font-medium text-text" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatUSD(l.precio_cliente_usd || 0)}</td>
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
                className="flex-1 bg-action-primary hover:bg-action-primary-hover text-on-action-primary h-control-lg rounded-sm text-button flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {estado === 'processing' ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                APPROVE
              </button>
              <button
                onClick={() => setShowCambios(true)}
                className="px-5 h-control-lg border border-border-control text-text-muted rounded-sm text-button hover:bg-bg-subtle"
              >
                Request Changes
              </button>
            </div>
          ) : (
            <div className="border border-border rounded-md p-4">
              <h3 className="font-semibold text-text mb-2">What would you like us to change?</h3>
              <textarea
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                placeholder="Tell us what needs to be adjusted..."
                className="w-full border border-border-control rounded-sm p-3 text-body mb-3 h-24 resize-none bg-bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
              />
              <div className="flex gap-2">
                <button
                  onClick={pedirCambios}
                  disabled={!comentario.trim() || estado === 'processing'}
                  className="flex-1 bg-action-primary hover:bg-action-primary-hover text-on-action-primary h-control-md rounded-sm text-button disabled:opacity-50"
                >
                  Send Request
                </button>
                <button
                  onClick={() => setShowCambios(false)}
                  className="px-4 h-control-md text-text-muted border border-border-control rounded-sm hover:bg-bg-subtle"
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
