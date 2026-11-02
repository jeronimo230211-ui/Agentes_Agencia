'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
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
            <h1 className="font-display heading-3 text-text-heading mb-2">Enlace inválido o expirado</h1>
            <p className="text-text-muted text-body">
              Este enlace ya fue usado o ha expirado (válido por 7 días).
              Solicita a Deisy que reenvíe la proforma para obtener un nuevo enlace.
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
              <h1 className="font-display heading-2 text-text-heading mb-2">¡Proforma aprobada!</h1>
              <p className="text-text-muted">
                La proforma <strong className="text-code text-text">{proforma?.numero}</strong> ha sido aprobada.
                Deisy recibirá una notificación para enviarla al cliente.
              </p>
            </>
          ) : (
            <>
              <XCircle size={56} className="text-danger mx-auto mb-4" />
              <h1 className="font-display heading-2 text-text-heading mb-2">Proforma rechazada</h1>
              <p className="text-text-muted">
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
          {/* Logo real — variante blanca del sistema de Marta (mismo patrón
              que (auth)/login). */}
          <Image src="/brand/europartners-horizontal-blanco.svg" alt="Europartners" width={147} height={26} priority />
          <p className="text-body-sm opacity-75 mt-1">Revisión de Proforma</p>
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

          {/* Tabla de líneas */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-body">
              <thead>
                <tr className="bg-bg-brand text-text-on-brand">
                  <th className="p-2 text-left">Descripción</th>
                  <th className="p-2 text-center">Qty</th>
                  <th className="p-2 text-right">Costo</th>
                  <th className="p-2 text-right">Precio</th>
                  <th className="p-2 text-right">Margen</th>
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
                    <td className="p-2 text-right text-text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatUSD(l.precio_costo_usd || 0)}</td>
                    <td className="p-2 text-right font-medium text-text" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatUSD(l.precio_cliente_usd || 0)}</td>
                    <td className={`p-2 text-right font-medium ${(l.margen_pct || 0) < 0.10 ? 'text-danger' : 'text-success'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
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
                className="flex-1 bg-action-primary hover:bg-action-primary-hover text-on-action-primary h-control-lg rounded-sm text-button flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {estado === 'processing' ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                APROBAR PROFORMA
              </button>
              <button
                onClick={() => setShowRechazo(true)}
                className="px-5 h-control-lg border border-danger text-danger rounded-sm text-button hover:bg-danger-bg"
              >
                Rechazar
              </button>
            </div>
          ) : (
            <div className="border border-danger rounded-md p-4">
              <h3 className="font-semibold text-text mb-2">Motivo de rechazo</h3>
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Indica qué debe corregir Deisy..."
                className="w-full border border-border-control rounded-sm p-3 text-body mb-3 h-24 resize-none bg-bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
              />
              <div className="flex gap-2">
                <button
                  onClick={rechazar}
                  disabled={!motivo.trim() || estado === 'processing'}
                  className="flex-1 bg-danger hover:opacity-90 text-on-danger h-control-md rounded-sm text-button disabled:opacity-50"
                >
                  Confirmar Rechazo
                </button>
                <button
                  onClick={() => setShowRechazo(false)}
                  className="px-4 h-control-md text-text-muted border border-border-control rounded-sm hover:bg-bg-subtle"
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
