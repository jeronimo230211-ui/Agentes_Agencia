'use client'
import { Suspense, useState, useEffect, useMemo, useCallback } from 'react'
import {
  Package, Link as LinkIcon, Check, X, ChevronRight,
  Copy, CheckCircle2, Undo2, Clock, Plus, Loader2, Mail, Pencil,
  TrendingUp, TrendingDown, Minus, History, Users, Tag,
} from 'lucide-react'
import { useRol } from '@/lib/useRol'
import { formatUSD, formatPct } from '@/lib/precio'
import { INCOTERM_SUGERENCIAS, INSURANCE_SUGERENCIAS } from '@/types/europartners'
import AgregarPrecioReferenciaModal from '@/components/AgregarPrecioReferenciaModal'
import FijarPrecioEspecialModal from '@/components/FijarPrecioEspecialModal'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import DataTable from '@/components/ui/DataTable'
import SearchField from '@/components/ui/SearchField'
import FilterChipRow from '@/components/ui/FilterChipRow'
import { useFiltrosUrl } from '@/lib/useFiltrosUrl'

interface Cliente {
  id: string
  nombre: string
  token_mayorista: string
  token_detallista: string
  contacto_nombre: string | null
  contacto_email: string | null
  contacto_telefono: string | null
  direccion: string | null
  incoterm_default: string | null
  freight_default: string | null
  insurance_default: string | null
}
interface Producto { id: string; codigo: string; nombre: string; imagen_url: string | null }
interface SolicitudLinea {
  id: string
  producto_id: string | null
  descripcion_libre: string | null
  cantidad: number
  producto: Producto | null
}
interface SolicitudEvento {
  id: string
  tipo: 'devuelta' | 'reenviada'
  comentario: string | null
  created_at: string
}
interface Solicitud {
  id: string
  estado: 'pendiente' | 'revisada' | 'convertida' | 'descartada' | 'devuelta'
  notas_cliente: string | null
  motivo_devolucion: string | null
  token_edicion: string | null
  veces_devuelta: number
  created_at: string
  cliente: { id: string; nombre: string } | null
  lineas: SolicitudLinea[]
  eventos: SolicitudEvento[]
}
interface OtroClienteReferencia {
  cliente_nombre: string
  tipo: 'mayorista' | 'detallista'
  precio_cliente_usd: number
  fecha_proforma: string | null
  proforma_numero: string | null
}
interface PrecioEspecialResumen {
  id: string
  precio_usd: number
  motivo: string | null
}
interface LineaComparacion {
  linea_id: string
  codigo: string | null
  tiene_historial: boolean
  ultimo_precio_cliente: number | null
  ultima_fecha: string | null
  ultimo_proforma_numero: string | null
  veces_comprado: number
  precio_catalogo_actual: number | null
  diferencia_usd: number | null
  diferencia_pct: number | null
  tendencia: 'subio' | 'bajo' | 'igual' | 'sin_datos'
  otros_clientes: OtroClienteReferencia[]
  precio_especial: PrecioEspecialResumen | null
}

// Colapso de colores ad-hoc a los 4 tokens semánticos (+ neutral) del
// sistema de Marta -- ver Badge.tsx. Este es el estado de la SOLICITUD
// (distinto del estado de la proforma en proformas/page.tsx).
const ESTADO_STYLE: Record<string, { variant: BadgeVariant; label: string }> = {
  pendiente:  { variant: 'warning', label: 'Pendiente' },
  revisada:   { variant: 'info',    label: 'Revisada' },
  convertida: { variant: 'success', label: 'Convertida' },
  descartada: { variant: 'neutral', label: 'Descartada' },
  devuelta:   { variant: 'warning', label: 'Devuelta al cliente' },
}

function fechaCorta(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

// useFiltrosUrl exige un boundary de Suspense en Next 14 -- mismo patrón
// que /proformas (ver app/(app)/proformas/page.tsx).
export default function SolicitudesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-text-subtle text-sm">Cargando...</div>}>
      <SolicitudesContent />
    </Suspense>
  )
}

function SolicitudesContent() {
  const { puedeEditar } = useRol()
  // 'estado' usa ESTADO_STYLE (ya definido arriba) para validar lo que venga
  // de la URL -- mismo criterio que /proformas (BUG-001): si alguien escribe
  // a mano un ?estado= que no existe, cae al default en vez de dejar la
  // pantalla filtrando por algo que la API nunca va a matchear.
  const { filtros, setFiltro, limpiarFiltros } = useFiltrosUrl(
    { q: '', estado: 'pendiente' },
    { estado: valor => valor === '' || valor in ESTADO_STYLE }
  )
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [seleccionada, setSeleccionada] = useState<Solicitud | null>(null)
  const [convirtiendo, setConvirtiendo] = useState(false)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const [copiadoTipo, setCopiadoTipo] = useState<'mayorista' | 'detallista' | null>(null)
  const [showNuevoCliente, setShowNuevoCliente] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [paisNuevo, setPaisNuevo] = useState('')
  const [tipoNuevo, setTipoNuevo] = useState<'mayorista' | 'detallista'>('mayorista')
  const [creandoCliente, setCreandoCliente] = useState(false)
  const [errorNuevoCliente, setErrorNuevoCliente] = useState('')
  const [editandoContactoId, setEditandoContactoId] = useState<string | null>(null)
  const [contactoForm, setContactoForm] = useState({
    contacto_nombre: '', contacto_email: '', contacto_telefono: '', direccion: '',
    incoterm_default: '', freight_default: '', insurance_default: '',
  })
  const [guardandoContactoId, setGuardandoContactoId] = useState<string | null>(null)
  const [errorContacto, setErrorContacto] = useState('')
  const [showLinks, setShowLinks] = useState(false)
  const [showDevolver, setShowDevolver] = useState(false)
  const [comentarioDevolver, setComentarioDevolver] = useState('')
  const [devolviendo, setDevolviendo] = useState(false)
  const [comparacion, setComparacion] = useState<Record<string, LineaComparacion> | null>(null)
  const [cargandoComparacion, setCargandoComparacion] = useState(false)
  const [agregandoPrecioCodigo, setAgregandoPrecioCodigo] = useState<string | null>(null)
  const [fijandoPrecioCodigo, setFijandoPrecioCodigo] = useState<string | null>(null)

  const cargar = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtros.estado) params.set('estado', filtros.estado)
    fetch(`/api/solicitudes?${params}`)
      .then(r => r.json())
      .then(({ data }) => { setSolicitudes(data || []); setLoading(false) })
  }, [filtros.estado])

  useEffect(() => {
    fetch('/api/clientes').then(r => r.json()).then(({ data }) => setClientes(data || []))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Búsqueda en tiempo real sobre lo que ya trajo el servidor para el estado
  // filtrado (AND con Estado). La tabla solo muestra el nombre del cliente
  // como texto identificador -- Fecha no es un campo de búsqueda, Artículos
  // es un conteo y Estado ya tiene su propio filtro -- así que ese es el
  // único campo con sentido real para el buscador.
  const solicitudesFiltradas = useMemo(() => {
    const q = filtros.q.trim().toLowerCase()
    if (!q) return solicitudes
    return solicitudes.filter(s => (s.cliente?.nombre ?? '').toLowerCase().includes(q))
  }, [solicitudes, filtros.q])

  const cargarComparacion = useCallback(() => {
    if (!seleccionada) { setComparacion(null); return }
    setCargandoComparacion(true)
    fetch(`/api/solicitudes/${seleccionada.id}/comparacion-historica`)
      .then(r => r.json())
      .then(({ data }) => {
        const porLinea: Record<string, LineaComparacion> = {}
        for (const l of (data?.lineas || []) as LineaComparacion[]) porLinea[l.linea_id] = l
        setComparacion(porLinea)
      })
      .catch(() => setComparacion({}))
      .finally(() => setCargandoComparacion(false))
  }, [seleccionada])

  useEffect(() => {
    setComparacion(null)
    cargarComparacion()
  }, [seleccionada?.id])

  async function quitarPrecioEspecial(overrideId: string) {
    const clienteId = seleccionada?.cliente?.id
    if (!clienteId) return
    await fetch(`/api/clientes/${clienteId}/precios-especiales/${overrideId}`, { method: 'PATCH' })
    cargarComparacion()
  }

  async function crearCliente() {
    if (!nombreNuevo.trim()) return
    setCreandoCliente(true)
    setErrorNuevoCliente('')
    const res = await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombreNuevo.trim(), pais: paisNuevo.trim() || undefined, tipo: tipoNuevo }),
    })
    const json = await res.json()
    setCreandoCliente(false)
    if (!res.ok) {
      setErrorNuevoCliente(json.error || 'Error al crear el cliente')
      return
    }
    setClientes(prev => [...prev, json.data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setNombreNuevo('')
    setPaisNuevo('')
    setTipoNuevo('mayorista')
    setShowNuevoCliente(false)
  }

  function abrirEditarContacto(cliente: Cliente) {
    setEditandoContactoId(cliente.id)
    setContactoForm({
      contacto_nombre: cliente.contacto_nombre || '',
      contacto_email: cliente.contacto_email || '',
      contacto_telefono: cliente.contacto_telefono || '',
      direccion: cliente.direccion || '',
      incoterm_default: cliente.incoterm_default || '',
      freight_default: cliente.freight_default || '',
      insurance_default: cliente.insurance_default || '',
    })
    setErrorContacto('')
  }

  async function guardarContactoCliente(clienteId: string) {
    setGuardandoContactoId(clienteId)
    setErrorContacto('')
    const res = await fetch(`/api/clientes/${clienteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contactoForm),
    })
    const json = await res.json()
    setGuardandoContactoId(null)
    if (!res.ok) { setErrorContacto(json.error || 'Error al guardar'); return }
    setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, ...json.data } : c))
    setEditandoContactoId(null)
  }

  function copiarLink(cliente: Cliente, tipo: 'mayorista' | 'detallista') {
    const token = tipo === 'mayorista' ? cliente.token_mayorista : cliente.token_detallista
    const url = `${window.location.origin}/solicitud/${token}`
    navigator.clipboard.writeText(url)
    setCopiadoId(cliente.id)
    setCopiadoTipo(tipo)
    setTimeout(() => { setCopiadoId(null); setCopiadoTipo(null) }, 2000)
  }

  async function convertir(solicitud: Solicitud) {
    setConvirtiendo(true)
    const res = await fetch(`/api/solicitudes/${solicitud.id}/convertir-proforma`, { method: 'POST' })
    if (res.ok) {
      const { data } = await res.json()
      window.location.href = `/cotizador/${data.id}`
    } else {
      setConvirtiendo(false)
    }
  }

  async function descartar(solicitud: Solicitud) {
    await fetch(`/api/solicitudes/${solicitud.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'descartada' }),
    })
    setSeleccionada(null)
    cargar()
  }

  async function devolver() {
    if (!seleccionada || !comentarioDevolver.trim()) return
    setDevolviendo(true)
    await fetch(`/api/solicitudes/${seleccionada.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'devuelta', comentario: comentarioDevolver.trim() }),
    })
    setDevolviendo(false)
    setShowDevolver(false)
    setComentarioDevolver('')
    setSeleccionada(null)
    cargar()
  }

  const estadosDisponibles = [
    { label: 'Pendientes', value: 'pendiente' },
    { label: 'Revisadas', value: 'revisada' },
    { label: 'Devueltas', value: 'devuelta' },
    { label: 'Convertidas', value: 'convertida' },
    { label: 'Descartadas', value: 'descartada' },
    { label: 'Todas', value: '' },
  ]

  const hayFiltrosActivos = filtros.q !== '' || filtros.estado !== 'pendiente'

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] overflow-hidden">
      {/* Encabezado */}
      <div className="px-8 pt-7 pb-4 bg-bg-surface border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-text-heading">Solicitudes de Clientes</h1>
            <p className="text-text-subtle text-sm mt-0.5">Pedidos entrantes antes de convertirlos en proforma</p>
          </div>
          <button
            onClick={() => setShowLinks(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm border border-border bg-bg-surface text-text-muted hover:bg-bg-subtle"
          >
            <LinkIcon size={15} /> Links de pedido por cliente
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <SearchField
            value={filtros.q}
            onChange={v => setFiltro('q', v)}
            placeholder="Buscar por cliente..."
            className="sm:max-w-xs"
          />
          <FilterChipRow
            options={estadosDisponibles}
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

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-8 py-4">
        <DataTable
          loading={loading}
          emptyMessage={filtros.q ? 'Ninguna solicitud coincide con la búsqueda' : 'No hay solicitudes en este estado'}
          rows={solicitudesFiltradas}
          rowKey={s => s.id}
          onRowClick={s => setSeleccionada(s)}
          columns={[
            { key: 'cliente', header: 'Cliente', cellClassName: 'font-medium text-text', render: s => s.cliente?.nombre ?? '—' },
            { key: 'fecha', header: 'Fecha', cellClassName: 'text-text-muted text-xs', render: s => fechaCorta(s.created_at) },
            {
              key: 'articulos',
              header: 'Artículos',
              align: 'center',
              render: s => (
                <span className="text-xs font-semibold text-text-muted bg-bg-subtle px-2 py-0.5 rounded-full">
                  {s.lineas?.length ?? 0}
                </span>
              ),
            },
            {
              key: 'estado',
              header: 'Estado',
              render: s => <Badge variant={ESTADO_STYLE[s.estado].variant}>{ESTADO_STYLE[s.estado].label}</Badge>,
            },
            { key: 'chevron', header: '', thClassName: 'w-8', cellClassName: 'text-text-subtle', render: () => <ChevronRight size={15} /> },
          ]}
        />
      </div>

      {/* Modal detalle */}
      {seleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-text">{seleccionada.cliente?.nombre}</h2>
                <p className="text-xs text-text-subtle">{fechaCorta(seleccionada.created_at)}</p>
              </div>
              <button onClick={() => setSeleccionada(null)} className="text-text-subtle hover:text-text-muted">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-3 mb-4">
                {seleccionada.lineas.map(l => {
                  const comp = comparacion?.[l.id]
                  return (
                    <div key={l.id} className="flex items-center gap-3 border-b border-border pb-3">
                      <div className="w-9 h-9 rounded-lg bg-bg-subtle flex items-center justify-center flex-shrink-0">
                        {l.producto?.imagen_url ? (
                          <img src={l.producto.imagen_url} alt="" className="w-full h-full object-contain rounded-lg" />
                        ) : (
                          <Package size={16} className="text-text-subtle" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {l.producto?.codigo && <p className="font-mono text-xs text-text-subtle">{l.producto.codigo}</p>}
                        <p className="text-sm text-text truncate">{l.producto?.nombre || l.descripcion_libre}</p>

                        {l.producto_id && (
                          cargandoComparacion ? (
                            <p className="text-[11px] text-text-subtle mt-0.5 animate-pulse">Consultando historial...</p>
                          ) : comp?.tiene_historial ? (
                            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[11px]">
                              <span className="flex items-center gap-1 text-text-subtle">
                                <History size={10} />
                                Antes {formatUSD(comp.ultimo_precio_cliente!)}
                                {comp.ultima_fecha && ` · ${fechaCorta(comp.ultima_fecha)}`}
                                {comp.ultimo_proforma_numero && ` · #${comp.ultimo_proforma_numero}`}
                              </span>
                              {comp.precio_catalogo_actual != null && comp.diferencia_pct != null && (
                                <span className={`flex items-center gap-0.5 font-semibold ${
                                  comp.tendencia === 'subio' ? 'text-success' : comp.tendencia === 'bajo' ? 'text-danger' : 'text-text-subtle'
                                }`}>
                                  {comp.tendencia === 'subio' && <TrendingUp size={10} />}
                                  {comp.tendencia === 'bajo' && <TrendingDown size={10} />}
                                  {comp.tendencia === 'igual' && <Minus size={10} />}
                                  Hoy {formatUSD(comp.precio_catalogo_actual)} ({comp.diferencia_pct >= 0 ? '+' : ''}{formatPct(comp.diferencia_pct)})
                                </span>
                              )}
                            </div>
                          ) : comp && !comp.tiene_historial ? (
                            <div className="mt-0.5 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-[11px] text-text-subtle">Sin historial de precio con este cliente</p>
                                {l.producto?.codigo && (
                                  <button
                                    onClick={() => setAgregandoPrecioCodigo(l.producto!.codigo)}
                                    className="text-[11px] text-action-primary hover:underline font-medium"
                                  >
                                    + Agregar precio de referencia
                                  </button>
                                )}
                              </div>
                              {comp.otros_clientes.length > 0 && (
                                <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-text-subtle">
                                  <Users size={10} className="flex-shrink-0" />
                                  {comp.otros_clientes.map((oc, i) => (
                                    <span key={i}>
                                      {oc.cliente_nombre}: <strong className="text-text-muted">{formatUSD(oc.precio_cliente_usd)}</strong>
                                      {oc.fecha_proforma && ` (${fechaCorta(oc.fecha_proforma)})`}
                                      {i < comp.otros_clientes.length - 1 && ' ·'}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : null
                        )}
                        {l.producto_id && l.producto?.codigo && !cargandoComparacion && (
                          <div className="mt-0.5">
                            {comp?.precio_especial ? (
                              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                                <Tag size={10} className="text-warning flex-shrink-0" />
                                <span className="text-warning font-semibold">
                                  Precio especial: {formatUSD(comp.precio_especial.precio_usd)}
                                </span>
                                {comp.precio_especial.motivo && (
                                  <span className="text-text-subtle">— {comp.precio_especial.motivo}</span>
                                )}
                                <button
                                  onClick={() => quitarPrecioEspecial(comp.precio_especial!.id)}
                                  className="text-text-subtle hover:text-danger hover:underline"
                                >
                                  Quitar
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setFijandoPrecioCodigo(l.producto!.codigo)}
                                className="text-[11px] text-warning hover:underline font-medium"
                              >
                                + Fijar precio especial para este cliente
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-text-muted flex-shrink-0">×{l.cantidad}</span>
                    </div>
                  )
                })}
              </div>

              {seleccionada.notas_cliente && (
                <div className="bg-warning-bg border border-warning rounded-lg p-3 mb-3">
                  <p className="text-xs font-semibold text-warning mb-1">Notas del cliente</p>
                  <p className="text-sm text-warning">{seleccionada.notas_cliente}</p>
                </div>
              )}

              {seleccionada.motivo_devolucion && seleccionada.estado === 'devuelta' && (
                <div className="bg-warning-bg border border-warning rounded-lg p-3 mb-3">
                  <p className="text-xs font-semibold text-warning mb-1">Observación enviada al cliente</p>
                  <p className="text-sm text-warning mb-2">{seleccionada.motivo_devolucion}</p>
                  {seleccionada.token_edicion && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/solicitud-editar/${seleccionada.token_edicion}`)
                        setCopiadoId(seleccionada.id)
                        setTimeout(() => setCopiadoId(null), 2000)
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-bg-surface border border-warning hover:bg-warning-bg text-warning"
                    >
                      {copiadoId === seleccionada.id ? (
                        <><CheckCircle2 size={13} className="text-success" /> Copiado</>
                      ) : (
                        <><Copy size={13} /> Copiar link para el cliente</>
                      )}
                    </button>
                  )}
                </div>
              )}

              {seleccionada.eventos && seleccionada.eventos.length > 0 && (
                <div className="border border-border rounded-lg p-3">
                  <p className="text-xs font-semibold text-text-muted mb-2 flex items-center gap-1.5">
                    <Clock size={12} /> Historial
                  </p>
                  <div className="space-y-2">
                    {[...seleccionada.eventos]
                      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                      .map(ev => (
                        <div key={ev.id} className="text-xs text-text-muted">
                          <span className="font-semibold">{ev.tipo === 'devuelta' ? 'Devuelta al cliente' : 'Cliente reenvió'}</span>
                          {' · '}{fechaCorta(ev.created_at)}
                          {ev.comentario && <p className="text-text-muted mt-0.5">{ev.comentario}</p>}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {puedeEditar && (seleccionada.estado === 'pendiente' || seleccionada.estado === 'revisada') && (
              <div className="p-5 border-t border-border flex gap-3">
                <button
                  onClick={() => convertir(seleccionada)}
                  disabled={convirtiendo}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-action-primary text-on-action-primary hover:bg-action-primary-hover disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <Check size={16} />
                  {convirtiendo ? 'Convirtiendo...' : 'Convertir a proforma'}
                </button>
                <button
                  onClick={() => setShowDevolver(true)}
                  className="px-4 py-2.5 rounded-xl border border-warning text-sm text-warning hover:bg-warning-bg flex items-center gap-1.5"
                >
                  <Undo2 size={15} /> Devolver
                </button>
                <button
                  onClick={() => descartar(seleccionada)}
                  className="px-4 py-2.5 rounded-xl border text-sm text-text-muted hover:bg-bg-subtle"
                >
                  Descartar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal agregar precio de referencia */}
      {agregandoPrecioCodigo && seleccionada?.cliente?.id && (
        <AgregarPrecioReferenciaModal
          clienteId={seleccionada.cliente.id}
          codigo={agregandoPrecioCodigo}
          onClose={() => setAgregandoPrecioCodigo(null)}
          onGuardado={() => { setAgregandoPrecioCodigo(null); cargarComparacion() }}
        />
      )}

      {fijandoPrecioCodigo && seleccionada?.cliente?.id && (
        <FijarPrecioEspecialModal
          clienteId={seleccionada.cliente.id}
          codigo={fijandoPrecioCodigo}
          onClose={() => setFijandoPrecioCodigo(null)}
          onGuardado={() => { setFijandoPrecioCodigo(null); cargarComparacion() }}
        />
      )}

      {/* Modal devolver con observación */}
      {showDevolver && seleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-bold text-text">Devolver pedido al cliente</h2>
              <button onClick={() => setShowDevolver(false)} className="text-text-subtle hover:text-text-muted">
                <X size={20} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-text-muted mb-3">
                {seleccionada.cliente?.nombre} recibirá un link para revisar y editar su pedido con tu observación.
              </p>
              <textarea
                autoFocus
                value={comentarioDevolver}
                onChange={e => setComentarioDevolver(e.target.value)}
                placeholder="Ej: ¿confirmas el color blanco para el modelo TZ-0425HS?"
                className="bg-bg-surface w-full border border-border rounded-lg p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-warning"
              />
            </div>
            <div className="p-5 border-t border-border flex gap-3">
              <button
                onClick={devolver}
                disabled={devolviendo || !comentarioDevolver.trim()}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-action-primary text-on-action-primary hover:bg-action-primary-hover disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {devolviendo ? 'Enviando...' : 'Devolver con observación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal links de pedido */}
      {showLinks && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-bold text-text">Links de pedido por cliente</h2>
              <button onClick={() => setShowLinks(false)} className="text-text-subtle hover:text-text-muted">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-2 max-h-[70vh] overflow-y-auto">
              <p className="text-xs text-text-subtle mb-3">
                Cada cliente tiene 2 links fijos — uno con precio mayorista y otro con precio
                detallista, según cuál le quieras compartir. Cada uno siempre lleva a su
                formulario de pedido con esos precios.
              </p>

              {!puedeEditar ? null : !showNuevoCliente ? (
                <button
                  onClick={() => setShowNuevoCliente(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-lg border border-dashed border-border text-text-muted hover:border-action-primary hover:text-action-primary mb-3"
                >
                  <Plus size={14} /> Nuevo cliente
                </button>
              ) : (
                <div className="border border-border rounded-lg p-3 mb-3 space-y-2 bg-bg-subtle">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Nombre del cliente"
                    value={nombreNuevo}
                    onChange={e => setNombreNuevo(e.target.value)}
                    className="bg-bg-surface w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus-ring"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="País (opcional)"
                      value={paisNuevo}
                      onChange={e => setPaisNuevo(e.target.value)}
                      className="bg-bg-surface flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus-ring"
                    />
                    <select
                      value={tipoNuevo}
                      onChange={e => setTipoNuevo(e.target.value as 'mayorista' | 'detallista')}
                      className="bg-bg-surface border border-border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus-ring"
                    >
                      <option value="mayorista">Mayorista</option>
                      <option value="detallista">Detallista</option>
                    </select>
                  </div>
                  {errorNuevoCliente && <p className="text-xs text-danger">{errorNuevoCliente}</p>}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => { setShowNuevoCliente(false); setErrorNuevoCliente('') }}
                      className="flex-1 text-xs font-semibold py-2 rounded-lg border border-border text-text-muted hover:bg-bg-subtle"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={crearCliente}
                      disabled={!nombreNuevo.trim() || creandoCliente}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg bg-action-primary text-on-action-primary hover:bg-action-primary-hover disabled:opacity-40"
                    >
                      {creandoCliente && <Loader2 size={13} className="animate-spin" />}
                      Crear cliente
                    </button>
                  </div>
                </div>
              )}

              {clientes.map(c => (
                <div key={c.id} className="border border-border rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-text">{c.nombre}</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        {c.contacto_email ? (
                          <span className="flex items-center gap-1 text-[11px] text-success truncate">
                            <Mail size={10} /> {c.contacto_email}
                          </span>
                        ) : (
                          <span className="text-[11px] text-warning">Sin correo de contacto</span>
                        )}
                        {puedeEditar && (
                          <button
                            onClick={() => editandoContactoId === c.id ? setEditandoContactoId(null) : abrirEditarContacto(c)}
                            className="text-text-subtle hover:text-action-primary flex-shrink-0"
                            title="Ver/editar contacto"
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => copiarLink(c, 'mayorista')}
                        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-bg-subtle hover:bg-bg-subtle text-text-muted"
                      >
                        {copiadoId === c.id && copiadoTipo === 'mayorista' ? (
                          <><CheckCircle2 size={13} className="text-success" /> Copiado</>
                        ) : (
                          <><Copy size={13} /> Mayorista</>
                        )}
                      </button>
                      <button
                        onClick={() => copiarLink(c, 'detallista')}
                        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-bg-subtle hover:bg-bg-subtle text-text-muted"
                      >
                        {copiadoId === c.id && copiadoTipo === 'detallista' ? (
                          <><CheckCircle2 size={13} className="text-success" /> Copiado</>
                        ) : (
                          <><Copy size={13} /> Detallista</>
                        )}
                      </button>
                    </div>
                  </div>

                  {editandoContactoId === c.id && (
                    <div className="mt-2.5 pt-2.5 border-t border-border space-y-2">
                      <input
                        type="text"
                        placeholder="Nombre de contacto"
                        value={contactoForm.contacto_nombre}
                        onChange={e => setContactoForm(f => ({ ...f, contacto_nombre: e.target.value }))}
                        className="bg-bg-surface w-full border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-focus-ring"
                      />
                      <input
                        type="email"
                        placeholder="Correo"
                        value={contactoForm.contacto_email}
                        onChange={e => setContactoForm(f => ({ ...f, contacto_email: e.target.value }))}
                        className="bg-bg-surface w-full border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-focus-ring"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Teléfono"
                          value={contactoForm.contacto_telefono}
                          onChange={e => setContactoForm(f => ({ ...f, contacto_telefono: e.target.value }))}
                          className="bg-bg-surface flex-1 border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-focus-ring"
                        />
                        <input
                          type="text"
                          placeholder="Dirección"
                          value={contactoForm.direccion}
                          onChange={e => setContactoForm(f => ({ ...f, direccion: e.target.value }))}
                          className="bg-bg-surface flex-1 border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-focus-ring"
                        />
                      </div>

                      <p className="text-[11px] font-semibold text-text-subtle uppercase pt-1.5">
                        Condiciones comerciales por defecto
                      </p>
                      <p className="text-[11px] text-text-subtle -mt-1.5">
                        Se usan al crear una proforma nueva para este cliente — siguen siendo
                        editables por proforma individual.
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          list={`incoterm-cliente-${c.id}`}
                          placeholder="Incoterm (ej. FOB)"
                          value={contactoForm.incoterm_default}
                          onChange={e => setContactoForm(f => ({ ...f, incoterm_default: e.target.value }))}
                          className="bg-bg-surface flex-1 border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-focus-ring"
                        />
                        <datalist id={`incoterm-cliente-${c.id}`}>
                          {INCOTERM_SUGERENCIAS.map(op => <option key={op} value={op} />)}
                        </datalist>
                        <input
                          type="text"
                          list={`incoterm-cliente-${c.id}`}
                          placeholder="Freight (ej. FOB)"
                          value={contactoForm.freight_default}
                          onChange={e => setContactoForm(f => ({ ...f, freight_default: e.target.value }))}
                          className="bg-bg-surface flex-1 border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-focus-ring"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          list={`insurance-cliente-${c.id}`}
                          placeholder="Insurance (ej. COLLECT)"
                          value={contactoForm.insurance_default}
                          onChange={e => setContactoForm(f => ({ ...f, insurance_default: e.target.value }))}
                          className="bg-bg-surface w-full border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-focus-ring"
                        />
                        <datalist id={`insurance-cliente-${c.id}`}>
                          {INSURANCE_SUGERENCIAS.map(op => <option key={op} value={op} />)}
                        </datalist>
                      </div>

                      {errorContacto && <p className="text-[11px] text-danger">{errorContacto}</p>}
                      <div className="flex gap-2 pt-0.5">
                        <button
                          onClick={() => setEditandoContactoId(null)}
                          className="flex-1 text-xs font-semibold py-1.5 rounded-lg border border-border text-text-muted hover:bg-bg-subtle"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => guardarContactoCliente(c.id)}
                          disabled={guardandoContactoId === c.id}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-lg bg-action-primary text-on-action-primary hover:bg-action-primary-hover disabled:opacity-40"
                        >
                          {guardandoContactoId === c.id && <Loader2 size={12} className="animate-spin" />}
                          Guardar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
