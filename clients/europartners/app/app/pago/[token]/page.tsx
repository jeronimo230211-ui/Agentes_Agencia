'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { Loader2, AlertCircle, CheckCircle, Upload, FileCheck, Ship } from 'lucide-react'

interface DespachoPago {
  id: string
  total_formateado: string | null
  pagado_formateado: string
  estado_flete: 'pendiente' | 'parcial' | 'pagado'
}

interface ProformaPago {
  numero: string
  cliente_nombre?: string
  total_formateado: string
  estado_pago: 'pendiente' | 'parcial' | 'pagado'
  comprobante_url: string | null
  // Pago de flete (migración 024_pago_flete_despacho.sql) — null si esta
  // proforma todavía no tiene despacho creado (nada que pagar de flete aún).
  despacho: DespachoPago | null
}

// Página pública — el cliente sube su comprobante de pago desde el link del
// correo, sin login. Este MISMO link (por token de `tokens_pago`, atado a
// proforma_id) ahora también sirve para el pago de flete del despacho de esa
// proforma (si ya existe uno) — se decidió extender esta página en vez de
// generar un link nuevo porque el cliente ya tiene este guardado y no
// conviene darle uno más para administrar.
export default function PagoPage({ params }: { params: { token: string } }) {
  const [estado, setEstado] = useState<'loading' | 'invalid' | 'ready'>('loading')
  const [proforma, setProforma] = useState<ProformaPago | null>(null)

  const cargar = useCallback(() => {
    fetch(`/api/pago/${params.token}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) { setEstado('invalid'); return }
        setProforma(json.proforma)
        setEstado('ready')
      })
      .catch(() => setEstado('invalid'))
  }, [params.token])

  useEffect(() => { cargar() }, [cargar])

  if (estado === 'loading') {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center">
        <Loader2 className="animate-spin text-action-primary" size={40} />
      </div>
    )
  }

  if (estado === 'invalid' || !proforma) {
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
            <h1 className="font-display heading-3 text-text-heading mb-2">Invalid or expired link</h1>
            <p className="text-text-muted text-body">Please contact Europartners to get a new link.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-page p-4">
      <div className="max-w-md mx-auto pt-8 pb-8 space-y-5">
        <div className="rounded-lg overflow-hidden shadow-lg">
          <div className="bg-bg-brand text-text-on-brand p-5">
            {/* Logo real — variante blanca del sistema de Marta (mismo
                patrón que (auth)/login). */}
            <Image src="/brand/europartners-horizontal-blanco.svg" alt="Europartners" width={147} height={26} priority />
            <p className="text-body-sm opacity-75 mt-1">Proforma {proforma.numero}</p>
          </div>
        </div>

        <SeccionFactura token={params.token} proforma={proforma} onGuardado={cargar} />

        {/* Sección de flete — solo aparece si ya hay un despacho creado para
            esta proforma. Si todavía no lo hay, no se muestra nada (no hay
            nada que pagar todavía) — ver GET /api/pago/[token], que devuelve
            despacho: null en ese caso. */}
        {proforma.despacho && (
          <SeccionFlete token={params.token} despacho={proforma.despacho} onGuardado={cargar} />
        )}
      </div>
    </div>
  )
}

// ─── Sección: pago de la factura (comportamiento igual al de siempre) ─────
function SeccionFactura({
  token, proforma, onGuardado,
}: {
  token: string
  proforma: ProformaPago
  onGuardado: () => void
}) {
  const [estado, setEstado] = useState<'form' | 'sending' | 'done' | 'error'>(
    proforma.estado_pago === 'pendiente' ? 'form' : 'done'
  )
  const [monto, setMonto] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function enviar() {
    if (!archivo) return
    if (!monto || Number(monto) <= 0) {
      setError('Enter the amount paid')
      setEstado('error')
      return
    }
    setEstado('sending')
    const formData = new FormData()
    formData.append('comprobante', archivo)
    formData.append('monto', monto)
    formData.append('tipo', 'cliente')

    const res = await fetch(`/api/pago/${token}`, { method: 'POST', body: formData })
    if (res.ok) {
      setEstado('done')
      onGuardado()
    } else {
      const j = await res.json()
      setError(j.error || 'Error uploading the payment proof')
      setEstado('error')
    }
  }

  if (estado === 'done') {
    return (
      <div className="bg-bg-surface rounded-lg shadow-lg p-6 text-center">
        {proforma.estado_pago === 'pagado' ? (
          <>
            <CheckCircle size={48} className="text-success mx-auto mb-3" />
            <h2 className="font-display heading-3 text-text-heading mb-1">Payment confirmed</h2>
            <p className="text-text-muted text-body">Europartners has confirmed your payment for proforma <strong className="text-code text-text">{proforma.numero}</strong>. We&apos;ll start the shipment soon.</p>
          </>
        ) : (
          <>
            <FileCheck size={48} className="text-info mx-auto mb-3" />
            <h2 className="font-display heading-3 text-text-heading mb-1">Payment proof received</h2>
            <p className="text-text-muted text-body">We&apos;re verifying your payment proof for proforma <strong className="text-code text-text">{proforma.numero}</strong>. We&apos;ll let you know once the shipment starts.</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-6">
      <h2 className="text-overline text-text-muted mb-3">Invoice payment</h2>
      <p className="text-text-muted text-body-sm mb-1">Total</p>
      <p className="font-display figure-lg text-text-heading mb-5" style={{ fontVariantNumeric: 'tabular-nums' }}>{proforma.total_formateado}</p>

      <label className="text-label text-text-muted">Amount paid</label>
      <input
        type="number"
        step="0.01"
        required
        placeholder="0.00"
        value={monto}
        onChange={e => setMonto(e.target.value)}
        className="w-full mt-1.5 mb-4 border border-border-control rounded-sm p-3 text-body bg-bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
      />

      <label className="text-label text-text-muted">Bank payment proof</label>
      <div
        onClick={() => fileRef.current?.click()}
        className="mt-1.5 mb-5 border-2 border-dashed border-border-control rounded-md p-6 text-center cursor-pointer hover:border-border-strong"
      >
        <Upload size={24} className="mx-auto mb-2 text-text-subtle" />
        <p className="text-text-muted text-body-sm">{archivo ? archivo.name : 'Tap to upload an image or PDF'}</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={e => setArchivo(e.target.files?.[0] || null)}
      />

      {estado === 'error' && error && (
        <div className="mb-4 bg-danger-bg border border-danger text-danger rounded-md p-2.5 text-caption flex items-center gap-2">
          <AlertCircle size={14} className="flex-none" />
          {error}
        </div>
      )}

      <button
        onClick={enviar}
        disabled={!archivo || !monto || estado === 'sending'}
        className="w-full h-control-lg rounded-sm text-button bg-action-primary hover:bg-action-primary-hover text-on-action-primary disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {estado === 'sending' && <Loader2 className="animate-spin" size={18} />}
        Send payment proof
      </button>
    </div>
  )
}

// ─── Sección: pago de flete del despacho (nueva, migración 024) ───────────
// Mismo patrón que SeccionFactura (monto obligatorio escrito a mano por el
// cliente — sin OCR — + comprobante), pero postea con tipo='flete' y
// despacho_id resuelto server-side. `estado_flete` viene calculado en vivo
// desde el GET (no hay columna persistida — ver comentario en la API route).
function SeccionFlete({
  token, despacho, onGuardado,
}: {
  token: string
  despacho: DespachoPago
  onGuardado: () => void
}) {
  const [estado, setEstado] = useState<'form' | 'sending' | 'done' | 'error'>(
    despacho.estado_flete === 'pagado' ? 'done' : 'form'
  )
  const [monto, setMonto] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function enviar() {
    if (!archivo) return
    if (!monto || Number(monto) <= 0) {
      setError('Enter the amount paid')
      setEstado('error')
      return
    }
    setEstado('sending')
    const formData = new FormData()
    formData.append('comprobante', archivo)
    formData.append('monto', monto)
    formData.append('tipo', 'flete')

    const res = await fetch(`/api/pago/${token}`, { method: 'POST', body: formData })
    if (res.ok) {
      setEstado('done')
      onGuardado()
    } else {
      const j = await res.json()
      setError(j.error || 'Error uploading the payment proof')
      setEstado('error')
    }
  }

  if (estado === 'done') {
    return (
      <div className="bg-bg-surface rounded-lg shadow-lg p-6 text-center">
        {despacho.estado_flete === 'pagado' ? (
          <>
            <CheckCircle size={48} className="text-success mx-auto mb-3" />
            <h2 className="font-display heading-3 text-text-heading mb-1">Freight payment confirmed</h2>
            <p className="text-text-muted text-body">Europartners has confirmed your freight payment for this shipment.</p>
          </>
        ) : (
          <>
            <FileCheck size={48} className="text-info mx-auto mb-3" />
            <h2 className="font-display heading-3 text-text-heading mb-1">Freight payment proof received</h2>
            <p className="text-text-muted text-body">We&apos;re verifying your freight payment proof. We&apos;ll let you know once it&apos;s confirmed.</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-2 mb-3">
        <Ship size={16} className="text-text-subtle" />
        <h2 className="text-overline text-text-muted">Freight payment</h2>
      </div>
      {despacho.total_formateado && (
        <>
          <p className="text-text-muted text-body-sm mb-1">Freight amount</p>
          <p className="font-display figure-lg text-text-heading mb-2" style={{ fontVariantNumeric: 'tabular-nums' }}>{despacho.total_formateado}</p>
        </>
      )}
      {despacho.estado_flete === 'parcial' && (
        <p className="text-info text-caption mb-4">Partial payment received: {despacho.pagado_formateado}</p>
      )}

      <label className="text-label text-text-muted">Amount paid</label>
      <input
        type="number"
        step="0.01"
        required
        placeholder="0.00"
        value={monto}
        onChange={e => setMonto(e.target.value)}
        className="w-full mt-1.5 mb-4 border border-border-control rounded-sm p-3 text-body bg-bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
      />

      <label className="text-label text-text-muted">Bank payment proof</label>
      <div
        onClick={() => fileRef.current?.click()}
        className="mt-1.5 mb-5 border-2 border-dashed border-border-control rounded-md p-6 text-center cursor-pointer hover:border-border-strong"
      >
        <Upload size={24} className="mx-auto mb-2 text-text-subtle" />
        <p className="text-text-muted text-body-sm">{archivo ? archivo.name : 'Tap to upload an image or PDF'}</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={e => setArchivo(e.target.files?.[0] || null)}
      />

      {estado === 'error' && error && (
        <div className="mb-4 bg-danger-bg border border-danger text-danger rounded-md p-2.5 text-caption flex items-center gap-2">
          <AlertCircle size={14} className="flex-none" />
          {error}
        </div>
      )}

      <button
        onClick={enviar}
        disabled={!archivo || !monto || estado === 'sending'}
        className="w-full h-control-lg rounded-sm text-button bg-action-primary hover:bg-action-primary-hover text-on-action-primary disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {estado === 'sending' && <Loader2 className="animate-spin" size={18} />}
        Send freight payment proof
      </button>
    </div>
  )
}
