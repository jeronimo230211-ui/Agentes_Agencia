'use client'
import { useState, useEffect, useMemo } from 'react'
import { Receipt, Clock, DollarSign, CheckCircle2, Ban, X, Loader2 } from 'lucide-react'
import { formatUSD } from '@/lib/precio'
import { useRol } from '@/lib/useRol'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'

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

// Colapso de 8 colores ad-hoc a los 4 tokens semánticos (+ neutral) del
// sistema de Marta -- ver Badge.tsx. "abonado" (antes morado) se mapea a
// info (mismo criterio que "parcial" en proformas/finanzas) y "anulada"
// (antes slate) a danger -- decisión aprobada por Jero (Lote 2, oct-2026).
const CLASIFICACION_STYLE: Record<Clasificacion, { label: string; variant: BadgeVariant; icon: React.ReactNode }> = {
  pendiente_facturacion: { label: 'Pendiente de facturación', variant: 'info',    icon: <Clock size={12} /> },
  pendiente_abono:       { label: 'Pendiente de abono',       variant: 'warning', icon: <DollarSign size={12} /> },
  abonado:               { label: 'Abonado',                  variant: 'info',    icon: <DollarSign size={12} /> },
  pagada:                { label: 'Pagada',                   variant: 'success', icon: <CheckCircle2 size={12} /> },
  anulada:               { label: 'Anulada',                  variant: 'danger',  icon: <Ban size={12} /> },
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
  const [marcando, setMarcando] = useState<ProformaFacturador | null>(null)

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
      <div className="px-8 pt-7 pb-4 bg-bg-surface border-b border-border flex-shrink-0">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-text-heading">Facturador</h1>
          <p className="text-text-subtle text-sm mt-0.5">
            Proformas que ya son un compromiso comercial — enviadas, facturadas y su estado de cobro
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {pills.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setFiltro(f => f === value ? '' : value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                filtro === value ? 'bg-bg-accent text-text-on-accent border-bg-accent' : 'bg-bg-surface text-text-muted border-border hover:border-border-control'
              }`}
            >
              {label}{value && ` (${conteos[value]})`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-text-subtle text-sm">Cargando...</div>
        ) : visibles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-text-subtle gap-2">
            <Receipt size={36} strokeWidth={1} />
            <p className="text-sm">No hay proformas con este filtro</p>
          </div>
        ) : (
          <div className="bg-bg-surface rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-subtle border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Número</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Fecha</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Estado</th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {visibles.map(({ p, clase }) => {
                  const st = CLASIFICACION_STYLE[clase]
                  const total = p.total_cif_usd ?? p.total_fob_usd ?? 0
                  return (
                    <tr key={p.id} className="border-b border-border hover:bg-bg-subtle transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-text-heading">{p.numero}</td>
                      <td className="px-4 py-3 text-text">{p.cliente?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-text-muted">{p.fecha}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatUSD(total)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={st.variant} icon={st.icon}>{st.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {rol === 'admin' && p.estado === 'enviada' && (
                          <button
                            onClick={() => setMarcando(p)}
                            className="text-xs font-semibold text-success hover:text-success flex items-center gap-1"
                          >
                            <CheckCircle2 size={13} /> Marcar facturada
                          </button>
                        )}
                        {rol === 'admin' && p.estado === 'facturada' && (
                          <button
                            onClick={() => setAnulando(p)}
                            className="text-xs font-semibold text-danger hover:text-danger flex items-center gap-1"
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

      {marcando && (
        <ModalMarcarFacturada
          proforma={marcando}
          onClose={() => setMarcando(null)}
          onMarcada={() => { setMarcando(null); cargar() }}
        />
      )}
    </div>
  )
}

function ModalMarcarFacturada({
  proforma, onClose, onMarcada,
}: {
  proforma: ProformaFacturador
  onClose: () => void
  onMarcada: () => void
}) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function confirmar() {
    setEnviando(true)
    setError('')
    const res = await fetch(`/api/proformas/${proforma.id}/marcar-facturada`, { method: 'POST' })
    const json = await res.json()
    setEnviando(false)
    if (!res.ok) { setError(json.error || 'Error al marcar como facturada'); return }
    onMarcada()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-text">Marcar como facturada</h2>
            <p className="text-xs text-text-subtle">{proforma.numero} · {proforma.cliente?.nombre}</p>
          </div>
          <button onClick={onClose} className="text-text-subtle hover:text-text-muted"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-text-muted">
            Úsalo solo cuando el cliente ya aprobó y/o pagó por fuera del sistema (WhatsApp, correo,
            llamada) y nunca usó el link de aprobación. Esto <strong>no le envía nada al cliente</strong> —
            solo actualiza el registro interno para que deje de verse como pendiente de facturación.
          </p>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
        <div className="flex gap-3 p-5 pt-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-border text-text-muted hover:bg-bg-subtle"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={enviando}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm text-white bg-success hover:opacity-90 disabled:opacity-50"
          >
            {enviando && <Loader2 size={14} className="animate-spin" />}
            Marcar como facturada
          </button>
        </div>
      </div>
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
      <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-text">Anular factura</h2>
            <p className="text-xs text-text-subtle">{proforma.numero} · {proforma.cliente?.nombre}</p>
          </div>
          <button onClick={onClose} className="text-text-subtle hover:text-text-muted"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-text-muted">
            Esta factura ya fue enviada al cliente. Anularla es permanente — no se puede editar ni
            volver a un estado anterior. Explica el motivo para dejarlo registrado.
          </p>
          <textarea
            autoFocus
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ej.: error en el total, cliente canceló el pedido..."
            className="bg-bg-surface w-full border border-border rounded-lg p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-danger"
          />
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
        <div className="flex gap-3 p-5 pt-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-border text-text-muted hover:bg-bg-subtle"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={enviando}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm text-on-danger bg-danger hover:opacity-90 disabled:opacity-50"
          >
            {enviando && <Loader2 size={14} className="animate-spin" />}
            Anular factura
          </button>
        </div>
      </div>
    </div>
  )
}
