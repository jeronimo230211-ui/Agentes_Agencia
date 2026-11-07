'use client'
import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import {
  Ship, Plus, X, Upload, CheckCircle2, Clock, PackageCheck,
  ChevronRight, AlertTriangle, Search, Wallet,
} from 'lucide-react'
import { formatUSD } from '@/lib/precio'
import { useRol } from '@/lib/useRol'
import HistorialPagos from '@/components/HistorialPagos'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import SearchField from '@/components/ui/SearchField'
import FilterChipRow from '@/components/ui/FilterChipRow'
import { useFiltrosUrl } from '@/lib/useFiltrosUrl'

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
  booking_no: string | null
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

// Colapso de colores ad-hoc a los 4 tokens semánticos (+ neutral) del
// sistema de Marta -- ver Badge.tsx.
const ESTADO_STYLE: Record<string, { variant: BadgeVariant; label: string; icon: React.ReactNode }> = {
  preparando:  { variant: 'neutral', label: 'Preparando',  icon: <Clock size={12} /> },
  en_transito: { variant: 'info',    label: 'En tránsito', icon: <Ship size={12} /> },
  en_puerto:   { variant: 'warning', label: 'En puerto',   icon: <PackageCheck size={12} /> },
  entregado:   { variant: 'success', label: 'Entregado',   icon: <CheckCircle2 size={12} /> },
}

// Opciones del chip row de Estado de la lista principal -- movidas a nivel
// de módulo (antes vivían dentro del componente) para poder reusar sus
// valores también en el validador de useFiltrosUrl.
const ESTADOS_FILTRO: { label: string; value: string }[] = [
  { label: 'Todos', value: '' },
  { label: 'Preparando', value: 'preparando' },
  { label: 'En tránsito', value: 'en_transito' },
  { label: 'En puerto', value: 'en_puerto' },
  { label: 'Entregado', value: 'entregado' },
]
const ESTADOS_FILTRO_VALIDOS = new Set(ESTADOS_FILTRO.map(e => e.value))

function fechaCorta(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function otifBadge(d: Despacho) {
  if (d.estado !== 'entregado' || !d.fecha_llegada_estimada || !d.fecha_llegada_real) return null
  const onTime = d.fecha_llegada_real <= d.fecha_llegada_estimada
  return (
    <Badge variant={onTime ? 'success' : 'danger'} icon={onTime ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}>
      {onTime ? 'OTIF' : 'Fuera de tiempo'}
    </Badge>
  )
}

// useSearchParams (dentro de useFiltrosUrl) exige un boundary de Suspense
// en Next 14 -- mismo patrón que /proformas.
export default function DespachosPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-text-subtle text-sm">Cargando...</div>}>
      <DespachosContent />
    </Suspense>
  )
}

function DespachosContent() {
  const { puedeEditar } = useRol()
  const [despachos, setDespachos] = useState<Despacho[]>([])
  const [proformas, setProformas] = useState<ProformaMini[]>([])
  const [loading, setLoading] = useState(true)
  const { filtros, setFiltro, limpiarFiltros } = useFiltrosUrl(
    { q: '', estado: '' },
    { estado: v => ESTADOS_FILTRO_VALIDOS.has(v) }
  )
  const [seleccionado, setSeleccionado] = useState<Despacho | null>(null)
  const [showNuevo, setShowNuevo] = useState(false)
  const [creando, setCreando] = useState(false)
  const [confirmandoPago, setConfirmandoPago] = useState<string | null>(null)
  const [busquedaModal, setBusquedaModal] = useState('')
  const [filtroPagoModal, setFiltroPagoModal] = useState<'' | 'listo' | 'pendiente'>('')

  const cargarDespachos = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtros.estado) params.set('estado', filtros.estado)
    fetch(`/api/despachos?${params}`)
      .then(r => r.json())
      .then(({ data }) => { setDespachos(data || []); setLoading(false) })
  }, [filtros.estado])

  useEffect(() => { cargarDespachos() }, [cargarDespachos])

  // Búsqueda en memoria sobre los despachos ya cargados (AND con el filtro
  // de Estado, que ya se aplica server-side en cargarDespachos arriba).
  const despachosFiltrados = useMemo(() => {
    const q = filtros.q.trim().toLowerCase()
    if (!q) return despachos
    return despachos.filter(d => {
      const campos = [d.proforma?.numero, d.proforma?.cliente?.nombre, d.naviera, d.booking_no]
      return campos.some(campo => campo?.toLowerCase().includes(q))
    })
  }, [despachos, filtros.q])

  const hayFiltrosActivos = filtros.q !== '' || filtros.estado !== ''

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

  const proformasFiltradasModal = useMemo(() => {
    const q = busquedaModal.trim().toLowerCase()
    return proformasSinDespacho.filter(p => {
      if (q && !p.numero.toLowerCase().includes(q)) return false
      if (filtroPagoModal) {
        const esHL = p.cliente?.slug === 'hl'
        const pagoOk = esHL || p.estado_pago === 'pagado'
        if (filtroPagoModal === 'listo' && !pagoOk) return false
        if (filtroPagoModal === 'pendiente' && pagoOk) return false
      }
      return true
    })
  }, [proformasSinDespacho, busquedaModal, filtroPagoModal])

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

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] overflow-hidden">
      <div className="px-8 pt-7 pb-4 bg-bg-surface border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-text-heading">Despachos</h1>
            <p className="text-text-subtle text-sm mt-0.5">Logística y tránsito del contenedor</p>
          </div>
          {puedeEditar && (
            <button
              onClick={() => { setShowNuevo(true); setBusquedaModal(''); setFiltroPagoModal(''); cargarProformasElegibles() }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm bg-action-primary text-on-action-primary hover:bg-action-primary-hover"
            >
              <Plus size={16} /> Nuevo despacho
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <SearchField
            value={filtros.q}
            onChange={v => setFiltro('q', v)}
            placeholder="Buscar por proforma, cliente, naviera o booking..."
            className="w-full sm:max-w-xs flex-shrink-0"
          />
          <FilterChipRow
            options={ESTADOS_FILTRO}
            value={filtros.estado}
            onChange={v => setFiltro('estado', v)}
          />
          {hayFiltrosActivos && (
            <button
              onClick={limpiarFiltros}
              className="flex items-center gap-1 text-xs text-text-subtle hover:text-danger flex-shrink-0"
            >
              <X size={12} /> Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-text-subtle text-sm">Cargando despachos...</div>
        ) : despachosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-text-subtle gap-2">
            <Ship size={36} strokeWidth={1} />
            <p className="text-sm">No hay despachos con este filtro</p>
          </div>
        ) : (
          <div className="bg-bg-surface rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-subtle border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Proforma / Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Naviera / BL</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Booking No.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Llegada est. / real</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">OTIF</th>
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {despachosFiltrados.map(d => {
                  const st = ESTADO_STYLE[d.estado]
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-border hover:bg-bg-subtle transition-colors cursor-pointer"
                      onClick={() => setSeleccionado(d)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-text-heading">{d.proforma?.numero ?? '—'}</span>
                        <span className="ml-2 text-xs text-text-subtle">{d.proforma?.cliente?.nombre}</span>
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs">
                        {d.naviera || '—'} {d.numero_bl ? `· ${d.numero_bl}` : ''}
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs font-mono">
                        {d.booking_no || '—'}
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                        {fechaCorta(d.fecha_llegada_estimada)} / {fechaCorta(d.fecha_llegada_real)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={st.variant} icon={st.icon}>{st.label}</Badge>
                      </td>
                      <td className="px-4 py-3">{otifBadge(d) || <span className="text-text-subtle text-xs">—</span>}</td>
                      <td className="px-4 py-3 text-text-subtle"><ChevronRight size={15} /></td>
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
          <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-bold text-text">Nuevo despacho</h2>
              <button onClick={() => setShowNuevo(false)} className="text-text-subtle hover:text-text-muted"><X size={20} /></button>
            </div>
            {proformasSinDespacho.length > 0 && (
              <div className="px-5 pt-4 pb-1 space-y-2 flex-shrink-0">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                  <input
                    value={busquedaModal}
                    onChange={e => setBusquedaModal(e.target.value)}
                    placeholder="Buscar por # de proforma..."
                    className="bg-bg-surface w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-focus-ring"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: 'Todos', value: '' as const },
                    { label: 'Listos para despacho', value: 'listo' as const },
                    { label: 'Pago pendiente', value: 'pendiente' as const },
                  ].map(({ label, value }) => (
                    <button
                      key={value}
                      onClick={() => setFiltroPagoModal(value)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                        filtroPagoModal === value ? 'bg-bg-accent text-text-on-accent border-bg-accent' : 'bg-bg-surface text-text-muted border-border hover:border-border-control'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-5">
              {proformasSinDespacho.length === 0 ? (
                <p className="text-sm text-text-subtle text-center py-6">No hay proformas enviadas sin despacho todavía</p>
              ) : proformasFiltradasModal.length === 0 ? (
                <p className="text-sm text-text-subtle text-center py-6">Ninguna proforma coincide con la búsqueda/filtro</p>
              ) : (
                <div className="space-y-2">
                  {proformasFiltradasModal.map(p => {
                    const esHL = p.cliente?.slug === 'hl'
                    const pagoOk = esHL || p.estado_pago === 'pagado'
                    const total = p.total_cif_usd ?? p.total_fob_usd ?? 0
                    return (
                      <div key={p.id} className="flex items-center justify-between border border-border rounded-xl px-4 py-3">
                        <div>
                          <p className="font-semibold text-sm text-text">{p.numero} · {p.cliente?.nombre}</p>
                          <p className="text-xs text-text-subtle">{formatUSD(total)}</p>
                          {!pagoOk && (
                            <p className="text-xs text-warning mt-0.5">Pago pendiente de confirmar</p>
                          )}
                        </div>
                        {pagoOk ? (
                          <button
                            onClick={() => crearDespacho(p.id)}
                            disabled={creando}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-action-primary text-on-action-primary hover:bg-action-primary-hover disabled:opacity-40"
                          >
                            Crear despacho
                          </button>
                        ) : (
                          <button
                            onClick={() => confirmarPago(p.id)}
                            disabled={confirmandoPago === p.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-warning-bg text-warning hover:opacity-80 disabled:opacity-40"
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
          puedeEditar={puedeEditar}
          onClose={() => setSeleccionado(null)}
          onCampo={actualizarCampo}
          onDocumento={subirDocumento}
        />
      )}
    </div>
  )
}

function DetalleDespacho({
  despacho, puedeEditar, onClose, onCampo, onDocumento,
}: {
  despacho: Despacho
  puedeEditar: boolean
  onClose: () => void
  onCampo: (id: string, campo: string, valor: string) => void
  onDocumento: (id: string, tipo: string, archivo: File) => void
}) {
  const ESTADOS: Despacho['estado'][] = ['preparando', 'en_transito', 'en_puerto', 'entregado']
  const [mostrarModalFlete, setMostrarModalFlete] = useState(false)
  const [pagosFleteRefreshKey, setPagosFleteRefreshKey] = useState(0)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-text">{despacho.proforma?.numero}</h2>
            <p className="text-xs text-text-subtle">{despacho.proforma?.cliente?.nombre}</p>
          </div>
          <button onClick={onClose} className="text-text-subtle hover:text-text-muted"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Estado */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase">Estado</label>
            <div className="flex gap-1.5 mt-1.5">
              {ESTADOS.map(e => (
                <button
                  key={e}
                  disabled={!puedeEditar}
                  onClick={() => onCampo(despacho.id, 'estado', e)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    despacho.estado === e ? 'bg-bg-accent text-text-on-accent border-bg-accent' : 'bg-bg-surface text-text-muted border-border'
                  }`}
                >
                  {ESTADO_STYLE[e].label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CampoTexto label="Naviera" valor={despacho.naviera} disabled={!puedeEditar} onChange={v => onCampo(despacho.id, 'naviera', v)} />
            <CampoTexto label="No. BL" valor={despacho.numero_bl} disabled={!puedeEditar} onChange={v => onCampo(despacho.id, 'numero_bl', v)} />
            <CampoTexto label="Booking No." valor={despacho.booking_no} disabled={!puedeEditar} onChange={v => onCampo(despacho.id, 'booking_no', v)} />
            <CampoTexto label="Puerto origen" valor={despacho.puerto_origen} disabled={!puedeEditar} onChange={v => onCampo(despacho.id, 'puerto_origen', v)} />
            <CampoTexto label="Puerto destino" valor={despacho.puerto_destino} disabled={!puedeEditar} onChange={v => onCampo(despacho.id, 'puerto_destino', v)} />
            <CampoFecha label="Fecha despacho" valor={despacho.fecha_despacho} disabled={!puedeEditar} onChange={v => onCampo(despacho.id, 'fecha_despacho', v)} />
            <CampoFecha label="Llegada estimada" valor={despacho.fecha_llegada_estimada} disabled={!puedeEditar} onChange={v => onCampo(despacho.id, 'fecha_llegada_estimada', v)} />
            <CampoFecha label="Llegada real" valor={despacho.fecha_llegada_real} disabled={!puedeEditar} onChange={v => onCampo(despacho.id, 'fecha_llegada_real', v)} />
            <CampoTexto label="Shipping fee USD" valor={despacho.shipping_fee_usd?.toString()} disabled={!puedeEditar} onChange={v => onCampo(despacho.id, 'shipping_fee_usd', v)} />
          </div>

          {/* Documentos */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase mb-1.5 block">Documentos</label>
            <div className="space-y-2">
              <DocumentoRow label="Bill of Lading" url={despacho.archivo_bl_url} puedeEditar={puedeEditar} onUpload={f => onDocumento(despacho.id, 'bl', f)} />
              <DocumentoRow label="Shipping Fee" url={despacho.archivo_shipping_fee_url} puedeEditar={puedeEditar} onUpload={f => onDocumento(despacho.id, 'shipping_fee', f)} />
              <DocumentoRow label="Picking Info" url={despacho.archivo_picking_url} puedeEditar={puedeEditar} onUpload={f => onDocumento(despacho.id, 'picking', f)} />
            </div>
          </div>

          {/* Pago de flete — lo que el CLIENTE paga por el shipping de este
              despacho (migración 024_pago_flete_despacho.sql). Distinto de
              "Shipping fee USD" de arriba, que es solo el monto de
              referencia que carga operaciones a mano — acá queda el
              historial real de cobros con comprobante, mismo patrón que
              "Registrar pago" del cotizador (tabla `pagos`, tipo='flete',
              despacho_id=este despacho). No cuenta hacia estado_pago de la
              proforma (eso sigue siendo solo la factura/mercancía). */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Wallet size={15} className="text-text-subtle" />
                <h3 className="font-medium text-text text-sm">Pago de flete</h3>
              </div>
              {puedeEditar && despacho.proforma?.id && (
                <button
                  onClick={() => setMostrarModalFlete(true)}
                  className="flex items-center gap-1.5 text-xs text-action-primary font-medium hover:bg-info-bg px-2.5 py-1.5 rounded-lg"
                >
                  <Plus size={14} />
                  Registrar pago de flete
                </button>
              )}
            </div>
            {despacho.proforma?.id ? (
              <HistorialPagos
                proformaId={despacho.proforma.id}
                refreshKey={pagosFleteRefreshKey}
                tipos={['flete']}
                vacioTexto="Todavía no hay pagos de flete registrados para este despacho."
              />
            ) : (
              <p className="text-sm text-text-subtle">No se pudo resolver la proforma de este despacho.</p>
            )}
          </div>
        </div>
      </div>

      {mostrarModalFlete && despacho.proforma?.id && (
        <RegistrarPagoFleteModal
          proformaId={despacho.proforma.id}
          despachoId={despacho.id}
          onClose={() => setMostrarModalFlete(false)}
          onGuardado={() => { setMostrarModalFlete(false); setPagosFleteRefreshKey(k => k + 1) }}
        />
      )}
    </div>
  )
}

// Mismo patrón visual/funcional que RegistrarPagoModal del cotizador
// (app/(app)/cotizador/[id]/page.tsx) — se separa en vez de reusar ese
// componente porque acá el tipo de pago está fijo ('flete', sin selector) y
// va ligado a un despacho puntual, no solo a la proforma.
function RegistrarPagoFleteModal({
  proformaId, despachoId, onClose, onGuardado,
}: {
  proformaId: string
  despachoId: string
  onClose: () => void
  onGuardado: () => void
}) {
  const [monto, setMonto] = useState('')
  const [comision, setComision] = useState('')
  const [referencia, setReferencia] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [nota, setNota] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    if (!monto || Number(monto) <= 0) {
      setError('Ingresa un monto válido')
      return
    }
    setGuardando(true)
    setError('')

    const formData = new FormData()
    formData.append('tipo', 'flete')
    formData.append('despacho_id', despachoId)
    formData.append('monto', monto)
    if (comision) formData.append('comision_bancaria', comision)
    if (referencia.trim()) formData.append('referencia', referencia.trim())
    formData.append('fecha', fecha)
    if (nota.trim()) formData.append('nota', nota.trim())
    if (archivo) formData.append('comprobante', archivo)

    const res = await fetch(`/api/proformas/${proformaId}/pagos`, { method: 'POST', body: formData })
    if (res.ok) {
      onGuardado()
    } else {
      const j = await res.json()
      setError(j.error || 'Error al registrar el pago')
    }
    setGuardando(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-md flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="p-4 border-b border-border flex items-center justify-between flex-none">
          <h3 className="font-bold text-text-heading">Registrar pago de flete</h3>
          <button onClick={onClose} className="p-1 hover:bg-bg-subtle rounded-lg">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-text-muted">Monto (USD)</label>
              <input
                type="number"
                step="0.01"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                placeholder="0.00"
                className="bg-bg-surface w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-muted">Comisión bancaria</label>
              <input
                type="number"
                step="0.01"
                value={comision}
                onChange={e => setComision(e.target.value)}
                placeholder="0.00"
                className="bg-bg-surface w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus-ring"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted">Referencia</label>
            <input
              type="text"
              value={referencia}
              onChange={e => setReferencia(e.target.value)}
              placeholder="No. de transferencia, wire, etc."
              className="bg-bg-surface w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="bg-bg-surface w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted">Nota</label>
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Observaciones (opcional)"
              className="bg-bg-surface w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm h-16 resize-none focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted">Comprobante (opcional)</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={e => setArchivo(e.target.files?.[0] || null)}
              className="w-full mt-1 text-sm text-text-muted"
            />
          </div>

          {error && (
            <div className="bg-danger-bg border border-danger text-danger rounded-lg p-2.5 text-xs">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-3 flex-none">
          <button onClick={onClose} className="text-sm text-text-muted hover:text-text">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="px-4 py-2 rounded-lg text-sm bg-action-primary text-on-action-primary hover:bg-action-primary-hover font-medium disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CampoTexto({ label, valor, disabled, onChange }: { label: string; valor?: string | null; disabled?: boolean; onChange: (v: string) => void }) {
  const [v, setV] = useState(valor || '')
  useEffect(() => setV(valor || ''), [valor])
  return (
    <div>
      <label className="text-xs font-semibold text-text-muted uppercase">{label}</label>
      <input
        value={v}
        disabled={disabled}
        onChange={e => setV(e.target.value)}
        onBlur={() => v !== (valor || '') && onChange(v)}
        className="w-full mt-1 border border-border rounded-lg px-2.5 py-1.5 text-sm bg-bg-surface focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:bg-bg-subtle disabled:text-text-subtle"
      />
    </div>
  )
}

function CampoFecha({ label, valor, disabled, onChange }: { label: string; valor?: string | null; disabled?: boolean; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-semibold text-text-muted uppercase">{label}</label>
      <input
        type="date"
        defaultValue={valor || ''}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="w-full mt-1 border border-border rounded-lg px-2.5 py-1.5 text-sm bg-bg-surface focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:bg-bg-subtle disabled:text-text-subtle"
      />
    </div>
  )
}

function DocumentoRow({ label, url, puedeEditar, onUpload }: { label: string; url?: string | null; puedeEditar: boolean; onUpload: (f: File) => void }) {
  return (
    <div className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
      <span className="text-sm text-text-muted">{label}</span>
      <div className="flex items-center gap-2">
        {url && <a href={url} target="_blank" rel="noreferrer" className="text-xs text-info underline">Ver</a>}
        {puedeEditar && (
          <label className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-bg-subtle hover:bg-bg-subtle text-text-muted cursor-pointer flex items-center gap-1">
            <Upload size={12} /> Subir
            <input type="file" className="hidden" onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
          </label>
        )}
      </div>
    </div>
  )
}
