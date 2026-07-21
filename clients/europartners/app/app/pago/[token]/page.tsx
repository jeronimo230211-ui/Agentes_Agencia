'use client'
import { useState, useEffect, useRef } from 'react'
import { Loader2, AlertCircle, CheckCircle, Upload, FileCheck } from 'lucide-react'

interface ProformaPago {
  numero: string
  cliente_nombre?: string
  total_formateado: string
  estado_pago: 'pendiente' | 'parcial' | 'pagado'
  comprobante_url: string | null
}

// Página pública — el cliente sube su comprobante de pago desde el link del correo, sin login.
export default function PagoPage({ params }: { params: { token: string } }) {
  const [estado, setEstado] = useState<'loading' | 'invalid' | 'form' | 'sending' | 'done' | 'error'>('loading')
  const [proforma, setProforma] = useState<ProformaPago | null>(null)
  const [monto, setMonto] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/pago/${params.token}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) { setEstado('invalid'); return }
        setProforma(json.proforma)
        setEstado(json.proforma.estado_pago === 'pendiente' ? 'form' : 'done')
      })
      .catch(() => setEstado('invalid'))
  }, [params.token])

  async function enviar() {
    if (!archivo) return
    setEstado('sending')
    const formData = new FormData()
    formData.append('comprobante', archivo)
    if (monto) formData.append('monto', monto)

    const res = await fetch(`/api/pago/${params.token}`, { method: 'POST', body: formData })
    if (res.ok) {
      setEstado('done')
    } else {
      const j = await res.json()
      setError(j.error || 'Error al subir el comprobante')
      setEstado('error')
    }
  }

  if (estado === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-[#1E3A5F]" size={40} />
      </div>
    )
  }

  if (estado === 'invalid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Enlace inválido o expirado</h1>
          <p className="text-gray-500 text-sm">Contacta a Europartners para obtener un nuevo enlace.</p>
        </div>
      </div>
    )
  }

  if (estado === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          {proforma?.estado_pago === 'pagado' ? (
            <>
              <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Pago confirmado</h1>
              <p className="text-gray-500">Europartners ya validó tu pago para la proforma <strong>{proforma?.numero}</strong>. Pronto iniciamos el despacho.</p>
            </>
          ) : (
            <>
              <FileCheck size={56} className="text-blue-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Comprobante recibido</h1>
              <p className="text-gray-500">Estamos validando tu comprobante para la proforma <strong>{proforma?.numero}</strong>. Te avisaremos cuando el despacho inicie.</p>
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
          <p className="text-gray-500 mb-4">{error}</p>
          <button onClick={() => setEstado('form')} className="px-5 py-2 rounded-lg font-medium text-white" style={{ background: '#1E3A5F' }}>
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto pt-8">
        <div className="bg-[#1E3A5F] text-white rounded-t-xl p-5">
          <h1 className="text-xl font-bold text-[#D4A017]">Europartners</h1>
          <p className="text-sm opacity-75">Comprobante de pago</p>
        </div>
        <div className="bg-white rounded-b-xl shadow-lg p-6">
          <p className="text-sm text-gray-500 mb-1">Proforma</p>
          <p className="text-lg font-bold text-[#1E3A5F] mb-4">{proforma?.numero}</p>
          <p className="text-sm text-gray-500 mb-1">Total</p>
          <p className="text-2xl font-bold text-gray-800 mb-5">{proforma?.total_formateado}</p>

          <label className="text-xs font-semibold text-gray-500 uppercase">Monto abonado (opcional)</label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={monto}
            onChange={e => setMonto(e.target.value)}
            className="w-full mt-1.5 mb-4 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
          />

          <label className="text-xs font-semibold text-gray-500 uppercase">Comprobante bancario</label>
          <div
            onClick={() => fileRef.current?.click()}
            className="mt-1.5 mb-5 border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-300"
          >
            <Upload size={24} className="mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-500">{archivo ? archivo.name : 'Toca para subir imagen o PDF'}</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={e => setArchivo(e.target.files?.[0] || null)}
          />

          <button
            onClick={enviar}
            disabled={!archivo || estado === 'sending'}
            className="w-full py-3 rounded-lg font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: '#1E3A5F' }}
          >
            {estado === 'sending' && <Loader2 className="animate-spin" size={18} />}
            Enviar comprobante
          </button>
        </div>
      </div>
    </div>
  )
}
