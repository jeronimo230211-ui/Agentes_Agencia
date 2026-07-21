'use client'
import { useState, useEffect } from 'react'
import { CheckCircle, Eye, Loader2, AlertCircle } from 'lucide-react'
import { formatUSD, formatPct } from '@/lib/precio'
import type { Proforma } from '@/types/europartners'

export default function AprobacionPage() {
  const [proformas, setProformas] = useState<Proforma[]>([])
  const [loading, setLoading] = useState(true)
  const [seleccionada, setSeleccionada] = useState<Proforma | null>(null)
  const [motivo, setMotivo] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')

  async function cargar() {
    const res = await fetch('/api/proformas?estado=en_revision')
    const { data } = await res.json()
    setProformas(data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function verDetalle(proforma: Proforma) {
    const res = await fetch(`/api/proformas/${proforma.id}`)
    const { data } = await res.json()
    setSeleccionada(data)
    setMotivo('')
    setError('')
  }

  async function aprobar() {
    if (!seleccionada) return
    setProcesando(true)
    setError('')
    const res = await fetch(`/api/proformas/${seleccionada.id}/aprobar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (res.ok) {
      setSeleccionada(null)
      await cargar()
    } else {
      const j = await res.json()
      setError(j.error || 'Error al aprobar')
    }
    setProcesando(false)
  }

  async function rechazar() {
    if (!seleccionada || !motivo.trim()) return
    setProcesando(true)
    setError('')
    const res = await fetch(`/api/proformas/${seleccionada.id}/rechazar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo }),
    })
    if (res.ok) {
      setSeleccionada(null)
      await cargar()
    } else {
      const j = await res.json()
      setError(j.error || 'Error al rechazar')
    }
    setProcesando(false)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#1E3A5F] mb-2">Aprobaciones</h1>
      <p className="text-gray-500 text-sm mb-6">Proformas que esperan tu revisión</p>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 size={32} className="animate-spin text-[#1E3A5F]" />
        </div>
      ) : proformas.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
          <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No hay proformas pendientes</p>
          <p className="text-gray-400 text-sm mt-1">Cuando Deisy envíe una, aparecerá aquí</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {proformas.map(p => (
            <div key={p.id} className="bg-white rounded-xl shadow-sm border border-yellow-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#1E3A5F] text-lg">{p.numero}</p>
                  <p className="text-gray-600 text-sm">{p.cliente?.nombre} · {p.incoterm}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{p.fecha} · creada por {p.creador?.nombre || 'Deisy'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Total {p.incoterm}</p>
                  <p className="text-xl font-bold text-[#1E3A5F]">
                    {formatUSD(p.total_cif_usd || p.total_fob_usd || 0)}
                  </p>
                  <button
                    onClick={() => verDetalle(p)}
                    className="mt-2 text-sm text-[#1E3A5F] underline flex items-center gap-1 ml-auto"
                  >
                    <Eye size={14} />
                    Revisar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Panel de revisión */}
      {seleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg text-[#1E3A5F]">{seleccionada.numero}</h2>
                <p className="text-sm text-gray-500">{seleccionada.cliente?.nombre} · {seleccionada.incoterm}</p>
              </div>
              <div className="flex gap-2">
                <a
                  href={`/api/proformas/${seleccionada.id}/pdf`}
                  target="_blank"
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  <Eye size={14} />
                  PDF
                </a>
                <button onClick={() => setSeleccionada(null)} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
              </div>
            </div>

            <div className="p-6">
              {/* Notas internas de Deisy */}
              {seleccionada.notas_internas && (
                <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm text-blue-800">
                  <strong>Nota de Deisy:</strong> {seleccionada.notas_internas}
                </div>
              )}

              {/* Tabla de líneas */}
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1E3A5F] text-white">
                      <th className="p-2 text-left">Descripción</th>
                      <th className="p-2 text-center">Qty</th>
                      <th className="p-2 text-right">Costo China</th>
                      <th className="p-2 text-right">Precio Cliente</th>
                      <th className="p-2 text-right">Margen</th>
                      <th className="p-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(seleccionada.lineas || []).map((l, i) => (
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
                        <td className="p-2 text-right">{formatUSD(l.subtotal_cliente_usd || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#1E3A5F]">
                      <td colSpan={5} className="p-2 font-bold text-right">
                        TOTAL {seleccionada.incoterm}
                      </td>
                      <td className="p-2 text-right font-bold text-[#1E3A5F] text-lg">
                        {formatUSD(seleccionada.total_cif_usd || seleccionada.total_fob_usd || 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm mb-4 flex gap-2">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {/* Botones */}
              <div className="space-y-3">
                <button
                  onClick={aprobar}
                  disabled={procesando}
                  className="w-full py-3 rounded-xl font-bold text-white text-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {procesando ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                  APROBAR PROFORMA
                </button>

                <div className="border border-red-100 rounded-xl p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Rechazar con motivo:</p>
                  <textarea
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    placeholder="Indica qué debe corregir Deisy..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-16 resize-none focus:outline-none focus:ring-1 focus:ring-red-300 mb-2"
                  />
                  <button
                    onClick={rechazar}
                    disabled={!motivo.trim() || procesando}
                    className="w-full py-2.5 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40"
                  >
                    Rechazar y notificar a Deisy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
