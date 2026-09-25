'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-[#1E3A5F]" size={40} />
      </div>
    )
  }

  if (estado === 'invalid' || !proforma) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Invalid or expired link</h1>
          <p className="text-gray-500 text-sm">Please contact Europartners to get a new link.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto pt-8 pb-8 space-y-5">
        <div className="rounded-xl overflow-hidden shadow-lg">
          <div className="bg-[#1E3A5F] text-white p-5">
            <h1 className="text-xl font-bold text-[#D4A017]">Europartners</h1>
            <p className="text-sm opacity-75">Proforma {proforma.numero}</p>
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
      <div className="bg-white rounded-xl shadow-lg p-6 text-center">
        {proforma.estado_pago === 'pagado' ? (
          <>
            <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-800 mb-1">Payment confirmed</h2>
            <p className="text-gray-500 text-sm">Europartners has confirmed your payment for proforma <strong>{proforma.numero}</strong>. We&apos;ll start the shipment soon.</p>
          </>
        ) : (
          <>
            <FileCheck size={48} className="text-blue-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-800 mb-1">Payment proof received</h2>
            <p className="text-gray-500 text-sm">We&apos;re verifying your payment proof for proforma <strong>{proforma.numero}</strong>. We&apos;ll let you know once the shipment starts.</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-sm font-bold text-gray-500 uppercase mb-3">Invoice payment</h2>
      <p className="text-sm text-gray-500 mb-1">Total</p>
      <p className="text-2xl font-bold text-gray-800 mb-5">{proforma.total_formateado}</p>

      <label className="text-xs font-semibold text-gray-500 uppercase">Amount paid</label>
      <input
        type="number"
        step="0.01"
        required
        placeholder="0.00"
        value={monto}
        onChange={e => setMonto(e.target.value)}
        className="w-full mt-1.5 mb-4 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
      />

      <label className="text-xs font-semibold text-gray-500 uppercase">Bank payment proof</label>
      <div
        onClick={() => fileRef.current?.click()}
        className="mt-1.5 mb-5 border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-300"
      >
        <Upload size={24} className="mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-500">{archivo ? archivo.name : 'Tap to upload an image or PDF'}</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={e => setArchivo(e.target.files?.[0] || null)}
      />

      {estado === 'error' && error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-2.5 text-xs flex items-center gap-2">
          <AlertCircle size={14} className="flex-none" />
          {error}
        </div>
      )}

      <button
        onClick={enviar}
        disabled={!archivo || !monto || estado === 'sending'}
        className="w-full py-3 rounded-lg font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
        style={{ background: '#1E3A5F' }}
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
      <div className="bg-white rounded-xl shadow-lg p-6 text-center">
        {despacho.estado_flete === 'pagado' ? (
          <>
            <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-800 mb-1">Freight payment confirmed</h2>
            <p className="text-gray-500 text-sm">Europartners has confirmed your freight payment for this shipment.</p>
          </>
        ) : (
          <>
            <FileCheck size={48} className="text-blue-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-800 mb-1">Freight payment proof received</h2>
            <p className="text-gray-500 text-sm">We&apos;re verifying your freight payment proof. We&apos;ll let you know once it&apos;s confirmed.</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center gap-2 mb-3">
        <Ship size={16} className="text-gray-400" />
        <h2 className="text-sm font-bold text-gray-500 uppercase">Freight payment</h2>
      </div>
      {despacho.total_formateado && (
        <>
          <p className="text-sm text-gray-500 mb-1">Freight amount</p>
          <p className="text-2xl font-bold text-gray-800 mb-2">{despacho.total_formateado}</p>
        </>
      )}
      {despacho.estado_flete === 'parcial' && (
        <p className="text-xs text-blue-600 mb-4">Partial payment received: {despacho.pagado_formateado}</p>
      )}

      <label className="text-xs font-semibold text-gray-500 uppercase">Amount paid</label>
      <input
        type="number"
        step="0.01"
        required
        placeholder="0.00"
        value={monto}
        onChange={e => setMonto(e.target.value)}
        className="w-full mt-1.5 mb-4 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
      />

      <label className="text-xs font-semibold text-gray-500 uppercase">Bank payment proof</label>
      <div
        onClick={() => fileRef.current?.click()}
        className="mt-1.5 mb-5 border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-300"
      >
        <Upload size={24} className="mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-500">{archivo ? archivo.name : 'Tap to upload an image or PDF'}</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={e => setArchivo(e.target.files?.[0] || null)}
      />

      {estado === 'error' && error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-2.5 text-xs flex items-center gap-2">
          <AlertCircle size={14} className="flex-none" />
          {error}
        </div>
      )}

      <button
        onClick={enviar}
        disabled={!archivo || !monto || estado === 'sending'}
        className="w-full py-3 rounded-lg font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
        style={{ background: '#1E3A5F' }}
      >
        {estado === 'sending' && <Loader2 className="animate-spin" size={18} />}
        Send freight payment proof
      </button>
    </div>
  )
}
