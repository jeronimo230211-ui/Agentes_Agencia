'use client'
import { useState, useEffect, useMemo } from 'react'
import { Receipt, Clock, DollarSign, CheckCircle2, Ban, X, Loader2 } from 'lucide-react'
import { formatUSD } from '@/lib/precio'
import { useRol } from '@/lib/useRol'

interface ClienteMini { id: string; nombre: string }
interface ProformaFacturador {
  id: string
  numero: string
  fecha: string
  estado: string
  estado_pago?: string
  total_fob_usd: number | null
  total_cif_usd: number | null
  cliente: ClienteMini | null
}

type Clasificacion = 'pendiente_facturacion' | 'pendiente_abono' | 'abonado' | 'pagada' | 'anulada'

const CLASIFICACION_STYLE: Record<Clasificacion, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  pendiente_facturacion: { label: 'Pendiente de facturación', bg: 'bg-blue-100',   text: 'text-blue-700',   icon: <Clock size={12} /> },
  pendiente_abono:       { label: 'Pendiente de abono',       bg: 'bg-yellow-100', text: 'text-yellow-700', icon: <DollarSign size={12} /> },
  abonado:               { label: 'Abonado',                  bg: 'bg-purple-100', text: 'text-purple-700', icon: <DollarSign size={12} /> },
  pagada:                { label: 'Pagada',                   bg: 'bg-green-100',  text: 'text-green-700',  icon: <CheckCircle2 size={12} /> },
  anulada:               { label: 'Anulada',                  bg: 'bg-slate-200',  text: 'text-slate-600',  icon: <Ban size={12} /> },
}

function clasificar(p: ProformaFacturador): Clasificacion {
  if (p.estado === 'anulada') return 'anulada'
  if (p.estado === 'enviada') return 'pendiente_facturacion'
  if (p.estado_pago === 'pagado') return 'pagada'
  if (p.estado_pago === 'parcial') return 'abonado'
  return 'pendiente_abono'
}

export default function FacturadorPage() {
  const { rol } = useRol()
  const [proformas, setProformas] = useState<ProformaFacturador[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Clasificacion | ''>('')
  const [anulando, setAnulando] = useState<ProformaFacturador | null>(null)

  function cargar() {
    setLoading(true)
    fetch('/api/proformas?estados=enviada,facturada,anulada&limit=500')
      .then(r => r.json())
      .then(({ data }) => { setProformas(data || []); setLoading(false) })
  }

  useEffect(() => { cargar() }, [])

  const clasificadas = useMemo(
    () => proformas.map(p => ({ p, clase: clasificar(p) })),
    [proformas]
  )

  const conteos = useMemo(() => {
    const c: Record<Clasificacion, number> = {
      pendiente_facturacion: 0, pendiente_abono: 0, abonado: 0, pagada: 0, anulada: 0,
    }
    for (const { clase } of clasificadas) c[clase]++
    return c
  }, [clasificadas])

  const visibles = useMemo(
    () => filtro ? clasificadas.filter(x => x.clase === filtro) : clasificadas,
    [clasificadas, filtro]
  )

  const pills: { label: string; value: Clasificacion | '' }[] = [
    { label: 'Todas', value: '' },
    { label: 'Pendiente de facturación', value: 'pendiente_facturacion' },
    { label: 'Pendiente de abono', value: 'pendiente_abono' },
    { label: 'Abonado', value: 'abonado' },
    { label: 'Pagada', value: 'pagada' },
    { label: 'Anulada', value: 'anulada' },
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] overflow-hidden">
      <div className="px-8 pt-7 pb-4 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Facturador</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Proformas que ya son un compromiso comercial — enviadas, facturadas y su estado de cobro
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {pills.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setFiltro(f => f === value ? '' : value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                filtro === value ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }`}
            >
              {label}{value && ` (${conteos[value]})`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Cargando...</div>
        ) : visibles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <Receipt size={36} strokeWidth={1} />
            <p className="text-sm">No hay proformas con este filtro</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Número</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Fecha</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Estado</th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {visibles.map(({ p, clase }) => {
                  const st = CLASIFICACION_STYLE[clase]
                  const total = p.total_cif_usd ?? p.total_fob_usd ?? 0
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#1E3A5F]">{p.numero}</td>
                      <td className="px-4 py-3 text-gray-700">{p.cliente?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{p.fecha}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatUSD(total)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                          {st.icon}{st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {rol === 'admin' && p.estado === 'facturada' && (
                          <button
                            onClick={() => setAnulando(p)}
                            className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1"
                          >
                            <Ban size={13} /> Anular
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {anulando && (
        <ModalAnular
          proforma={anulando}
          onClose={() => setAnulando(null)}
          onAnulado={() => { setAnulando(null); cargar() }}
        />
      )}
    </div>
  )
}

function ModalAnular({
  proforma, onClose, onAnulado,
}: {
  proforma: ProformaFacturador
  onClose: () => void
  onAnulado: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function confirmar() {
    if (!motivo.trim()) { setError('El motivo es obligatorio'); return }
    setEnviando(true)
    setError('')
    const res = await fetch(`/api/proformas/${proforma.id}/anular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo }),
    })
    const json = await res.json()
    setEnviando(false)
    if (!res.ok) { setError(json.error || 'Error al anular'); return }
    onAnulado()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Anular factura</h2>
            <p className="text-xs text-gray-400">{proforma.numero} · {proforma.cliente?.nombre}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-500">
            Esta factura ya fue enviada al cliente. Anularla es permanente — no se puede editar ni
            volver a un estado anterior. Explica el motivo para dejarlo registrado.
          </p>
          <textarea
            autoFocus
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ej.: error en el total, cliente canceló el pedido..."
            className="w-full border border-gray-200 rounded-lg p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex gap-3 p-5 pt-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={enviando}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {enviando && <Loader2 size={14} className="animate-spin" />}
            Anular factura
          </button>
        </div>
      </div>
    </div>
  )
}
