'use client'
import { useState, useEffect } from 'react'
import { CheckCircle, Eye, Loader2, AlertCircle } from 'lucide-react'
import { formatUSD, formatPct, calcMargen } from '@/lib/precio'
import type { Proforma } from '@/types/europartners'

export default function AprobacionPage() {
  const [proformas, setProformas] = useState<Proforma[]>([])
  const [loading, setLoading] = useState(true)
  const [seleccionada, setSeleccionada] = useState<Proforma | null>(null)
  const [motivo, setMotivo] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [preciosEditados, setPreciosEditados] = useState<Record<string, number>>({})

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
    setPreciosEditados({})
  }

  async function aprobar() {
    if (!seleccionada) return
    setProcesando(true)
    setError('')
    const lineas_ajustadas = (seleccionada.lineas || []).map(l => ({
      id: l.id,
      precio_cliente_usd: preciosEditados[l.id] ?? l.precio_cliente_usd,
      margen_pct: calcMargen(l.precio_costo_usd || 0, preciosEditados[l.id] ?? l.precio_cliente_usd ?? 0),
      cantidad: l.cantidad,
    }))
    const res = await fetch(`/api/proformas/${seleccionada.id}/aprobar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineas_ajustadas }),
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
      <h1 className="text-2xl font-bold text-text-heading mb-2">Aprobaciones</h1>
      <p className="text-text-muted text-sm mb-6">Proformas que esperan tu revisión</p>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 size={32} className="animate-spin text-text-heading" />
        </div>
      ) : proformas.length === 0 ? (
        <div className="bg-bg-surface rounded-xl p-12 text-center shadow-sm border border-border">
          <CheckCircle size={40} className="text-success mx-auto mb-3" />
          <p className="text-text-muted font-medium">No hay proformas pendientes</p>
          <p className="text-text-subtle text-sm mt-1">Cuando Deisy envíe una, aparecerá aquí</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {proformas.map(p => (
            <div key={p.id} className="bg-bg-surface rounded-xl shadow-sm border border-warning p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-text-heading text-lg">{p.numero}</p>
                  <p className="text-text-muted text-sm">{p.cliente?.nombre} · {p.incoterm}</p>
                  <p className="text-text-subtle text-xs mt-0.5">{p.fecha} · creada por {p.creador?.nombre || 'Deisy'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-subtle">Total {p.incoterm}</p>
                  <p className="text-xl font-bold text-text-heading">
                    {formatUSD(p.total_cif_usd || p.total_fob_usd || 0)}
                  </p>
                  <button
                    onClick={() => verDetalle(p)}
                    className="mt-2 text-sm text-text-heading underline flex items-center gap-1 ml-auto"
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
          <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-bg-surface border-b border-border px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg text-text-heading">{seleccionada.numero}</h2>
                <p className="text-sm text-text-muted">{seleccionada.cliente?.nombre} · {seleccionada.incoterm}</p>
              </div>
              <div className="flex gap-2">
                <a
                  href={`/api/proformas/${seleccionada.id}/pdf`}
                  target="_blank"
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm text-text-muted hover:bg-bg-subtle"
                >
                  <Eye size={14} />
                  PDF
                </a>
                <button onClick={() => setSeleccionada(null)} className="text-text-subtle hover:text-text-muted p-1">✕</button>
              </div>
            </div>

            <div className="p-6">
              {/* Notas internas de Deisy */}
              {seleccionada.notas_internas && (
                <div className="bg-info-bg rounded-lg p-3 mb-4 text-sm text-info">
                  <strong>Nota de Deisy:</strong> {seleccionada.notas_internas}
                </div>
              )}

              {/* Cambio pedido por el cliente (si esta proforma vuelve de cambios_solicitados) */}
              {seleccionada.comentario_cliente && (
                <div className="bg-warning-bg border border-warning rounded-lg p-3 mb-4 text-sm text-warning">
                  <strong>El cliente pidió este cambio:</strong> {seleccionada.comentario_cliente}
                </div>
              )}

              {/* Tabla de líneas */}
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-brand text-text-on-brand">
                      <th className="p-2 text-left">Descripción</th>
                      <th className="p-2 text-center">Qty</th>
                      <th className="p-2 text-right">Costo China</th>
                      <th className="p-2 text-right">Precio Cliente</th>
                      <th className="p-2 text-right">Margen</th>
                      <th className="p-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(seleccionada.lineas || []).map((l, i) => {
                      const precioActual = preciosEditados[l.id] ?? l.precio_cliente_usd ?? 0
                      const margenActual = calcMargen(l.precio_costo_usd || 0, precioActual)
                      const subtotalActual = precioActual * (l.cantidad || 0)
                      return (
                        <tr key={l.id} className={i % 2 === 0 ? 'bg-bg-surface' : 'bg-bg-subtle'}>
                          <td className="p-2">
                            <div>{l.descripcion_pdf}</div>
                            <div className="text-xs text-text-subtle">{l.codigo_pdf}</div>
                          </td>
                          <td className="p-2 text-center">{l.cantidad}</td>
                          <td className="p-2 text-right text-text-muted">{formatUSD(l.precio_costo_usd || 0)}</td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={precioActual}
                              onChange={e => setPreciosEditados(prev => ({ ...prev, [l.id]: Number(e.target.value) }))}
                              className="bg-bg-surface w-24 text-right border border-border rounded px-1.5 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-focus-ring"
                            />
                          </td>
                          <td className={`p-2 text-right font-medium ${margenActual < 0.10 ? 'text-danger' : 'text-success'}`}>
                            {formatPct(margenActual)}
                          </td>
                          <td className="p-2 text-right">{formatUSD(subtotalActual)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-ultramar">
                      <td colSpan={5} className="p-2 font-bold text-right">
                        TOTAL {seleccionada.incoterm}
                      </td>
                      <td className="p-2 text-right font-bold text-text-heading text-lg">
                        {formatUSD(
                          (seleccionada.lineas || []).reduce((sum, l) => {
                            const precio = preciosEditados[l.id] ?? l.precio_cliente_usd ?? 0
                            return sum + precio * (l.cantidad || 0)
                          }, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {error && (
                <div className="bg-danger-bg text-danger rounded-lg p-3 text-sm mb-4 flex gap-2">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {/* Botones */}
              <div className="space-y-3">
                <button
                  onClick={aprobar}
                  disabled={procesando}
                  className="w-full py-3 rounded-xl font-bold text-on-action-primary text-lg bg-action-primary hover:bg-action-primary-hover disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {procesando ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                  APROBAR PROFORMA
                </button>

                <div className="border border-danger rounded-xl p-4">
                  <p className="text-sm font-medium text-text mb-2">Rechazar con motivo:</p>
                  <textarea
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    placeholder="Indica qué debe corregir Deisy..."
                    className="bg-bg-surface w-full border border-border rounded-lg px-3 py-2 text-sm h-16 resize-none focus:outline-none focus:ring-1 focus:ring-danger mb-2"
                  />
                  <button
                    onClick={rechazar}
                    disabled={!motivo.trim() || procesando}
                    className="w-full py-2.5 rounded-lg font-bold text-on-danger bg-danger hover:opacity-90 disabled:opacity-40"
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
