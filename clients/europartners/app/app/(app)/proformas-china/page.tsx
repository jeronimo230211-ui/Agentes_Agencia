'use client'
import { useState, useEffect, useCallback } from 'react'
import { Package, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, Ship } from 'lucide-react'
import { formatUSD } from '@/lib/precio'
import type { ProformaChina, EstadoLineaChina } from '@/types/europartners'

// Revisión de proformas de China (Emily) — módulo aparte, ver migración
// 017. Al aprobar una línea, actualiza productos.precio_fob_usd; la
// conversión a proforma cliente la sigue haciendo Deisy a mano como hoy
// (piloto, decisión de Jero 2026-08-27).
export default function ProformasChinaPage() {
  const [proformas, setProformas] = useState<ProformaChina[]>([])
  const [loading, setLoading] = useState(true)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [decisiones, setDecisiones] = useState<Record<string, EstadoLineaChina>>({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/proformas-china')
    if (res.ok) {
      const j = await res.json()
      setProformas(j.data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function abrir(pc: ProformaChina) {
    if (abierta === pc.id) {
      setAbierta(null)
      return
    }
    setAbierta(pc.id)
    const iniciales: Record<string, EstadoLineaChina> = {}
    for (const l of pc.lineas || []) iniciales[l.id] = 'aprobada'
    setDecisiones(iniciales)
  }

  async function aplicar(pc: ProformaChina) {
    setGuardando(true)
    setError('')
    const lineas = (pc.lineas || []).map(l => ({ id: l.id, decision: decisiones[l.id] || 'rechazada' }))
    const res = await fetch(`/api/proformas-china/${pc.id}/revisar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineas }),
    })
    setGuardando(false)
    if (res.ok) {
      setAbierta(null)
      await cargar()
    } else {
      const j = await res.json()
      setError(j.error || 'Error al guardar')
    }
  }

  const pendientes = proformas.filter(p => p.estado === 'enviada')
  const resueltas = proformas.filter(p => p.estado !== 'enviada')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#1E3A5F]" size={32} />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Ship size={22} className="text-[#1E3A5F]" />
        <h1 className="text-xl font-bold text-gray-800">Proformas de China (Emily)</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Costos propuestos por Emily. Al aprobar una línea se actualiza el costo del catálogo — la
        proforma del cliente se sigue armando como siempre desde Proformas.
      </p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {pendientes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 mb-8">
          <Package size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay proformas de China pendientes de revisión</p>
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {pendientes.map(pc => (
            <div key={pc.id} className="bg-white rounded-xl border border-amber-200 overflow-hidden">
              <button
                onClick={() => abrir(pc)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-amber-50/40 transition-colors"
              >
                <div className="text-left">
                  <p className="font-semibold text-gray-800 text-sm">
                    {pc.colaborador?.nombre || 'Emily'} · {pc.lineas?.length || 0} línea{(pc.lineas?.length || 0) !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-gray-400">{new Date(pc.created_at).toLocaleString()}</p>
                </div>
                {abierta === pc.id ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
              </button>

              {abierta === pc.id && (
                <div className="border-t border-gray-100">
                  {pc.notas && (
                    <p className="px-5 py-3 text-sm text-gray-600 bg-gray-50 border-b border-gray-100">{pc.notas}</p>
                  )}
                  <div className="divide-y divide-gray-50">
                    {(pc.lineas || []).map(l => {
                      const decision = decisiones[l.id] || 'aprobada'
                      const delta = l.precio_fob_anterior
                        ? ((l.precio_fob_propuesto - l.precio_fob_anterior) / l.precio_fob_anterior) * 100
                        : null
                      return (
                        <div key={l.id} className="px-5 py-3 flex items-center gap-4">
                          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {l.producto?.imagen_url ? (
                              <img src={l.producto.imagen_url} alt="" className="w-full h-full object-contain" />
                            ) : (
                              <Package size={14} className="text-gray-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-xs font-bold text-[#1E3A5F]">{l.producto?.codigo}</p>
                            <p className="text-sm text-gray-700 truncate">{l.producto?.nombre}</p>
                          </div>
                          <div className="text-right text-xs text-gray-400 w-20 flex-shrink-0">
                            {l.precio_fob_anterior != null ? formatUSD(l.precio_fob_anterior) : '—'}
                            <p className="text-[10px]">antes</p>
                          </div>
                          <div className="text-right w-24 flex-shrink-0">
                            <p className="text-sm font-bold text-gray-800">{formatUSD(l.precio_fob_propuesto)}</p>
                            {delta != null && (
                              <p className={`text-[10px] ${delta > 0 ? 'text-red-500' : delta < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                              </p>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 w-14 flex-shrink-0 text-right">×{l.cantidad}</p>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => setDecisiones(prev => ({ ...prev, [l.id]: 'aprobada' }))}
                              className={`p-1.5 rounded-lg border ${decision === 'aprobada' ? 'bg-green-50 border-green-300 text-green-600' : 'border-gray-200 text-gray-300 hover:text-gray-500'}`}
                            >
                              <CheckCircle2 size={16} />
                            </button>
                            <button
                              onClick={() => setDecisiones(prev => ({ ...prev, [l.id]: 'rechazada' }))}
                              className={`p-1.5 rounded-lg border ${decision === 'rechazada' ? 'bg-red-50 border-red-300 text-red-600' : 'border-gray-200 text-gray-300 hover:text-gray-500'}`}
                            >
                              <XCircle size={16} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="p-4 border-t border-gray-100 flex justify-end">
                    <button
                      onClick={() => aplicar(pc)}
                      disabled={guardando}
                      className="px-5 py-2.5 rounded-lg font-bold text-sm text-white disabled:opacity-50 flex items-center gap-2"
                      style={{ background: '#1E3A5F' }}
                    >
                      {guardando && <Loader2 size={14} className="animate-spin" />}
                      Aplicar decisiones
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {resueltas.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">Ya revisadas</h2>
          <div className="space-y-2">
            {resueltas.map(pc => (
              <div key={pc.id} className="bg-white rounded-xl border border-gray-100 px-5 py-3 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {pc.colaborador?.nombre || 'Emily'} · {pc.lineas?.length || 0} línea{(pc.lineas?.length || 0) !== 1 ? 's' : ''}
                  <span className="text-gray-400 ml-2">{new Date(pc.created_at).toLocaleDateString()}</span>
                </p>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${pc.estado === 'aprobada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {pc.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
