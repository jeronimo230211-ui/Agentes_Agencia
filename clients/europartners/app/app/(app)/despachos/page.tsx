'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Ship, Plus, X, Upload, CheckCircle2, Clock, PackageCheck,
  ChevronRight, AlertTriangle,
} from 'lucide-react'
import { formatUSD } from '@/lib/precio'

interface ClienteMini { id: string; nombre: string; slug?: string }
interface ProformaMini {
  id: string; numero: string; estado: string; estado_pago?: string
  total_fob_usd: number | null; total_cif_usd: number | null
  cliente: ClienteMini | null
}
interface Despacho {
  id: string
  naviera: string | null
  numero_bl: string | null
  puerto_origen: string
  puerto_destino: string
  fecha_despacho: string | null
  fecha_llegada_estimada: string | null
  fecha_llegada_real: string | null
  shipping_fee_usd: number | null
  estado: 'preparando' | 'en_transito' | 'en_puerto' | 'entregado'
  archivo_bl_url: string | null
  archivo_shipping_fee_url: string | null
  archivo_picking_url: string | null
  picking_descripcion: string | null
  notas: string | null
  proforma: ProformaMini | null
}

const ESTADO_STYLE: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
  preparando:  { bg: 'bg-gray-100',  text: 'text-gray-600',  label: 'Preparando',  icon: <Clock size={12} /> },
  en_transito: { bg: 'bg-blue-100',  text: 'text-blue-700',  label: 'En tránsito', icon: <Ship size={12} /> },
  en_puerto:   { bg: 'bg-yellow-100',text: 'text-yellow-700',label: 'En puerto',   icon: <PackageCheck size={12} /> },
  entregado:   { bg: 'bg-green-100', text: 'text-green-700', label: 'Entregado',   icon: <CheckCircle2 size={12} /> },
}

function fechaCorta(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function otifBadge(d: Despacho) {
  if (d.estado !== 'entregado' || !d.fecha_llegada_estimada || !d.fecha_llegada_real) return null
  const onTime = d.fecha_llegada_real <= d.fecha_llegada_estimada
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
      onTime ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
    }`}>
      {onTime ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
      {onTime ? 'OTIF' : 'Fuera de tiempo'}
    </span>
  )
}

export default function DespachosPage() {
  const [despachos, setDespachos] = useState<Despacho[]>([])
  const [proformas, setProformas] = useState<ProformaMini[]>([])
  const [loading, setLoading] = useState(true)
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [seleccionado, setSeleccionado] = useState<Despacho | null>(null)
  const [showNuevo, setShowNuevo] = useState(false)
  const [creando, setCreando] = useState(false)
  const [confirmandoPago, setConfirmandoPago] = useState<string | null>(null)

  const cargarDespachos = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (estadoFiltro) params.set('estado', estadoFiltro)
    fetch(`/api/despachos?${params}`)
      .then(r => r.json())
      .then(({ data }) => { setDespachos(data || []); setLoading(false) })
  }, [estadoFiltro])

  useEffect(() => { cargarDespachos() }, [cargarDespachos])

  function cargarProformasElegibles() {
    fetch('/api/proformas?estado=enviada&limit=300')
      .then(r => r.json())
      .then(({ data }) => setProformas(data || []))
  }

  // Proformas enviadas que aún no tienen despacho
  const proformasSinDespacho = useMemo(() => {
    const idsConDespacho = new Set(despachos.map(d => d.proforma?.id).filter(Boolean))
    return proformas.filter(p => !idsConDespacho.has(p.id))
  }, [proformas, despachos])

  async function confirmarPago(proformaId: string) {
    setConfirmandoPago(proformaId)
    await fetch(`/api/proformas/${proformaId}/confirmar-pago`, { method: 'POST' })
    cargarProformasElegibles()
    setConfirmandoPago(null)
  }

  async function crearDespacho(proformaId: string) {
    setCreando(true)
    const res = await fetch('/api/despachos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proforma_id: proformaId }),
    })
    if (res.ok) {
      setShowNuevo(false)
      cargarDespachos()
    }
    setCreando(false)
  }

  async function actualizarCampo(id: string, campo: string, valor: string) {
    const res = await fetch(`/api/despachos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [campo]: valor }),
    })
    if (res.ok) {
      const { data } = await res.json()
      setSeleccionado(data)
      cargarDespachos()
    }
  }

  async function subirDocumento(id: string, tipo: string, archivo: File) {
    const formData = new FormData()
    formData.append('tipo', tipo)
    formData.append('archivo', archivo)
    const res = await fetch(`/api/despachos/${id}/documento`, { method: 'POST', body: formData })
    if (res.ok) {
      const { data } = await res.json()
      setSeleccionado(data)
      cargarDespachos()
    }
  }

  const estadosDisponibles = [
    { label: 'Todos', value: '' },
    { label: 'Preparando', value: 'preparando' },
    { label: 'En tránsito', value: 'en_transito' },
    { label: 'En puerto', value: 'en_puerto' },
    { label: 'Entregado', value: 'entregado' },
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] overflow-hidden">
      <div className="px-8 pt-7 pb-4 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-[#1E3A5F]">Despachos</h1>
            <p className="text-gray-400 text-sm mt-0.5">Logística y tránsito del contenedor</p>
          </div>
          <button
            onClick={() => { setShowNuevo(true); cargarProformasElegibles() }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-white"
            style={{ background: '#D4A017', color: '#1E3A5F' }}
          >
            <Plus size={16} /> Nuevo despacho
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {estadosDisponibles.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setEstadoFiltro(value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                estadoFiltro === value ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Cargando despachos...</div>
        ) : despachos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <Ship size={36} strokeWidth={1} />
            <p className="text-sm">No hay despachos con este filtro</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Proforma / Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Naviera / BL</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Llegada est. / real</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">OTIF</th>
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {despachos.map(d => {
                  const st = ESTADO_STYLE[d.estado]
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors cursor-pointer"
                      onClick={() => setSeleccionado(d)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-[#1E3A5F]">{d.proforma?.numero ?? '—'}</span>
                        <span className="ml-2 text-xs text-gray-400">{d.proforma?.cliente?.nombre}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {d.naviera || '—'} {d.numero_bl ? `· ${d.numero_bl}` : ''}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {fechaCorta(d.fecha_llegada_estimada)} / {fechaCorta(d.fecha_llegada_real)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                          {st.icon}{st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">{otifBadge(d) || <span className="text-gray-300 text-xs">—</span>}</td>
                      <td className="px-4 py-3 text-gray-300"><ChevronRight size={15} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal nuevo despacho */}
      {showNuevo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Nuevo despacho</h2>
              <button onClick={() => setShowNuevo(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {proformasSinDespacho.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No hay proformas enviadas sin despacho todavía</p>
              ) : (
                <div className="space-y-2">
                  {proformasSinDespacho.map(p => {
                    const esHL = p.cliente?.slug === 'hl'
                    const pagoOk = esHL || p.estado_pago === 'pagado'
                    const total = p.total_cif_usd ?? p.total_fob_usd ?? 0
                    return (
                      <div key={p.id} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3">
                        <div>
                          <p className="font-semibold text-sm text-gray-800">{p.numero} · {p.cliente?.nombre}</p>
                          <p className="text-xs text-gray-400">{formatUSD(total)}</p>
                          {!pagoOk && (
                            <p className="text-xs text-yellow-600 mt-0.5">Pago pendiente de confirmar</p>
                          )}
                        </div>
                        {pagoOk ? (
                          <button
                            onClick={() => crearDespacho(p.id)}
                            disabled={creando}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
                            style={{ background: '#1E3A5F' }}
                          >
                            Crear despacho
                          </button>
                        ) : (
                          <button
                            onClick={() => confirmarPago(p.id)}
                            disabled={confirmandoPago === p.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-yellow-100 text-yellow-700 hover:bg-yellow-200 disabled:opacity-40"
                          >
                            {confirmandoPago === p.id ? 'Confirmando...' : 'Confirmar pago'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle / edición */}
      {seleccionado && (
        <DetalleDespacho
          despacho={seleccionado}
          onClose={() => setSeleccionado(null)}
          onCampo={actualizarCampo}
          onDocumento={subirDocumento}
        />
      )}
    </div>
  )
}

function DetalleDespacho({
  despacho, onClose, onCampo, onDocumento,
}: {
  despacho: Despacho
  onClose: () => void
  onCampo: (id: string, campo: string, valor: string) => void
  onDocumento: (id: string, tipo: string, archivo: File) => void
}) {
  const ESTADOS: Despacho['estado'][] = ['preparando', 'en_transito', 'en_puerto', 'entregado']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{despacho.proforma?.numero}</h2>
            <p className="text-xs text-gray-400">{despacho.proforma?.cliente?.nombre}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Estado */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Estado</label>
            <div className="flex gap-1.5 mt-1.5">
              {ESTADOS.map(e => (
                <button
                  key={e}
                  onClick={() => onCampo(despacho.id, 'estado', e)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                    despacho.estado === e ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-gray-500 border-gray-200'
                  }`}
                >
                  {ESTADO_STYLE[e].label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CampoTexto label="Naviera" valor={despacho.naviera} onChange={v => onCampo(despacho.id, 'naviera', v)} />
            <CampoTexto label="No. BL" valor={despacho.numero_bl} onChange={v => onCampo(despacho.id, 'numero_bl', v)} />
            <CampoTexto label="Puerto origen" valor={despacho.puerto_origen} onChange={v => onCampo(despacho.id, 'puerto_origen', v)} />
            <CampoTexto label="Puerto destino" valor={despacho.puerto_destino} onChange={v => onCampo(despacho.id, 'puerto_destino', v)} />
            <CampoFecha label="Fecha despacho" valor={despacho.fecha_despacho} onChange={v => onCampo(despacho.id, 'fecha_despacho', v)} />
            <CampoFecha label="Llegada estimada" valor={despacho.fecha_llegada_estimada} onChange={v => onCampo(despacho.id, 'fecha_llegada_estimada', v)} />
            <CampoFecha label="Llegada real" valor={despacho.fecha_llegada_real} onChange={v => onCampo(despacho.id, 'fecha_llegada_real', v)} />
            <CampoTexto label="Shipping fee USD" valor={despacho.shipping_fee_usd?.toString()} onChange={v => onCampo(despacho.id, 'shipping_fee_usd', v)} />
          </div>

          {/* Documentos */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Documentos</label>
            <div className="space-y-2">
              <DocumentoRow label="Bill of Lading" url={despacho.archivo_bl_url} onUpload={f => onDocumento(despacho.id, 'bl', f)} />
              <DocumentoRow label="Shipping Fee" url={despacho.archivo_shipping_fee_url} onUpload={f => onDocumento(despacho.id, 'shipping_fee', f)} />
              <DocumentoRow label="Picking Info" url={despacho.archivo_picking_url} onUpload={f => onDocumento(despacho.id, 'picking', f)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CampoTexto({ label, valor, onChange }: { label: string; valor?: string | null; onChange: (v: string) => void }) {
  const [v, setV] = useState(valor || '')
  useEffect(() => setV(valor || ''), [valor])
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase">{label}</label>
      <input
        value={v}
        onChange={e => setV(e.target.value)}
        onBlur={() => v !== (valor || '') && onChange(v)}
        className="w-full mt-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
      />
    </div>
  )
}

function CampoFecha({ label, valor, onChange }: { label: string; valor?: string | null; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase">{label}</label>
      <input
        type="date"
        defaultValue={valor || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full mt-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
      />
    </div>
  )
}

function DocumentoRow({ label, url, onUpload }: { label: string; url?: string | null; onUpload: (f: File) => void }) {
  return (
    <div className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        {url && <a href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">Ver</a>}
        <label className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 cursor-pointer flex items-center gap-1">
          <Upload size={12} /> Subir
          <input type="file" className="hidden" onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
        </label>
      </div>
    </div>
  )
}
