'use client'
import { useState, useEffect } from 'react'
import { Receipt } from 'lucide-react'
import { formatUSD } from '@/lib/precio'
import type { Pago, TipoPago } from '@/types/europartners'

function fechaCorta(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const ESTILO_TIPO: Record<TipoPago, { badge: string; label: string }> = {
  cliente: { badge: 'bg-blue-50 text-blue-600', label: 'cobro al cliente' },
  china: { badge: 'bg-amber-50 text-amber-600', label: 'pago a China' },
  // 'flete' — migración 024_pago_flete_despacho.sql, pago que el cliente hace
  // por el shipping de su embarque (despacho_id), no por la mercancía.
  flete: { badge: 'bg-emerald-50 text-emerald-600', label: 'pago de flete' },
}

// Historial de pagos (Registro Maestro Vivo) de una proforma — cobros al
// cliente, pagos a China y pagos de flete. Consume GET
// /api/proformas/[id]/pagos (ver migración 021_tabla_pagos.sql y, para
// 'flete', 024_pago_flete_despacho.sql). Componente compartido entre el
// editor de proforma (cotizador/[id]), el drawer de detalle de /finanzas y
// el modal de despacho (/despachos), para no duplicar el fetch ni el render
// del timeline en varios lugares.
//
// `tipos`: filtro opcional de qué tipos de pago mostrar (ej. ['flete'] en el
// modal de despacho, para no mezclar el timeline de flete con el de cobro de
// la proforma). El fetch sigue siendo por proforma_id — no hace falta un
// endpoint nuevo por despacho_id porque hoy la relación proforma↔despacho es
// 1:1 (ver POST /api/despachos, que bloquea un segundo despacho por proforma).
export default function HistorialPagos({
  proformaId,
  refreshKey = 0,
  tipos,
  vacioTexto = 'Todavía no hay pagos registrados para esta proforma.',
}: {
  proformaId: string
  refreshKey?: number
  tipos?: TipoPago[]
  vacioTexto?: string
}) {
  const [pagos, setPagos] = useState<Pago[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    fetch(`/api/proformas/${proformaId}/pagos`)
      .then(r => r.json())
      .then(({ data }) => { if (!cancelado) setPagos(data || []) })
      .catch(() => { if (!cancelado) setPagos([]) })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [proformaId, refreshKey])

  const pagosFiltrados = tipos ? pagos.filter(p => tipos.includes(p.tipo)) : pagos

  if (loading) {
    return <p className="text-sm text-gray-400">Cargando pagos...</p>
  }

  if (pagosFiltrados.length === 0) {
    return <p className="text-sm text-gray-400">{vacioTexto}</p>
  }

  return (
    <div className="space-y-2">
      {pagosFiltrados.map(pago => (
        <div key={pago.id} className="flex items-start justify-between gap-3 border-b border-gray-50 last:border-0 pb-2 last:pb-0">
          <div className="flex items-start gap-2.5">
            <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-none ${ESTILO_TIPO[pago.tipo].badge}`}>
              <Receipt size={13} />
            </div>
            <div>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">{formatUSD(pago.monto)}</span>{' '}
                <span className="text-gray-400">— {ESTILO_TIPO[pago.tipo].label}</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {fechaCorta(pago.fecha)}
                {pago.referencia && ` · ${pago.referencia}`}
                {pago.comision_bancaria > 0 && ` · comisión ${formatUSD(pago.comision_bancaria)}`}
                {' · '}{pago.usuario?.nombre || 'Cliente (autoservicio)'}
              </p>
              {pago.nota && <p className="text-xs text-gray-400 mt-0.5">{pago.nota}</p>}
            </div>
          </div>
          {pago.comprobante_url && (
            <a
              href={pago.comprobante_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 underline flex-none"
            >
              Ver comprobante
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
