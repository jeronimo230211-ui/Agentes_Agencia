'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Inbox, Package, Link as LinkIcon, Check, X, ChevronRight,
  Copy, CheckCircle2, Undo2, Clock, Plus, Loader2, Mail, Pencil,
  TrendingUp, TrendingDown, Minus, History, Users,
} from 'lucide-react'
import { useRol } from '@/lib/useRol'
import { formatUSD, formatPct } from '@/lib/precio'
import AgregarPrecioReferenciaModal from '@/components/AgregarPrecioReferenciaModal'

interface Cliente {
  id: string
  nombre: string
  token_mayorista: string
  token_detallista: string
  contacto_nombre: string | null
  contacto_email: string | null
  contacto_telefono: string | null
  direccion: string | null
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
}

const ESTADO_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  pendiente:  { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pendiente' },
  revisada:   { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Revisada' },
  convertida: { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Convertida' },
  descartada: { bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'Descartada' },
  devuelta:   { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Devuelta al cliente' },
}

function fechaCorta(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function SolicitudesPage() {
  const { puedeEditar } = useRol()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [estadoFiltro, setEstadoFiltro] = useState('pendiente')
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
  const [contactoForm, setContactoForm] = useState({ contacto_nombre: '', contacto_email: '', contacto_telefono: '', direccion: '' })
  const [guardandoContactoId, setGuardandoContactoId] = useState<string | null>(null)
  const [errorContacto, setErrorContacto] = useState('')
  const [showLinks, setShowLinks] = useState(false)
  const [showDevolver, setShowDevolver] = useState(false)
  const [comentarioDevolver, setComentarioDevolver] = useState('')
  const [devolviendo, setDevolviendo] = useState(false)
  const [comparacion, setComparacion] = useState<Record<string, LineaComparacion> | null>(null)
  const [cargandoComparacion, setCargandoComparacion] = useState(false)
  const [agregandoPrecioCodigo, setAgregandoPrecioCodigo] = useState<string | null>(null)

  const cargar = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (estadoFiltro) params.set('estado', estadoFiltro)
    fetch(`/api/solicitudes?${params}`)
      .then(r => r.json())
      .then(({ data }) => { setSolicitudes(data || []); setLoading(false) })
  }, [estadoFiltro])

  useEffect(() => {
    fetch('/api/clientes').then(r => r.json()).then(({ data }) => setClientes(data || []))
  }, [])

  useEffect(() => { cargar() }, [cargar])

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

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] overflow-hidden">
      {/* Encabezado */}
      <div className="px-8 pt-7 pb-4 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-[#1E3A5F]">Solicitudes de Clientes</h1>
            <p className="text-gray-400 text-sm mt-0.5">Pedidos entrantes antes de convertirlos en proforma</p>
          </div>
          <button
            onClick={() => setShowLinks(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          >
            <LinkIcon size={15} /> Links de pedido por cliente
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

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-8 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Cargando solicitudes...</div>
        ) : solicitudes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <Inbox size={36} strokeWidth={1} />
            <p className="text-sm">No hay solicitudes en este estado</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Fecha</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Artículos</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Estado</th>
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {solicitudes.map(s => {
                  const st = ESTADO_STYLE[s.estado]
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors cursor-pointer"
                      onClick={() => setSeleccionada(s)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">{s.cliente?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{fechaCorta(s.created_at)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {s.lineas?.length ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300"><ChevronRight size={15} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal detalle */}
      {seleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{seleccionada.cliente?.nombre}</h2>
                <p className="text-xs text-gray-400">{fechaCorta(seleccionada.created_at)}</p>
              </div>
              <button onClick={() => setSeleccionada(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-3 mb-4">
                {seleccionada.lineas.map(l => {
                  const comp = comparacion?.[l.id]
                  return (
                    <div key={l.id} className="flex items-center gap-3 border-b border-gray-50 pb-3">
                      <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                        {l.producto?.imagen_url ? (
                          <img src={l.producto.imagen_url} alt="" className="w-full h-full object-contain rounded-lg" />
                        ) : (
                          <Package size={16} className="text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {l.producto?.codigo && <p className="font-mono text-xs text-gray-400">{l.producto.codigo}</p>}
                        <p className="text-sm text-gray-800 truncate">{l.producto?.nombre || l.descripcion_libre}</p>

                        {l.producto_id && (
                          cargandoComparacion ? (
                            <p className="text-[11px] text-gray-300 mt-0.5 animate-pulse">Consultando historial...</p>
                          ) : comp?.tiene_historial ? (
                            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[11px]">
                              <span className="flex items-center gap-1 text-gray-400">
                                <History size={10} />
                                Antes {formatUSD(comp.ultimo_precio_cliente!)}
                                {comp.ultima_fecha && ` · ${fechaCorta(comp.ultima_fecha)}`}
                                {comp.ultimo_proforma_numero && ` · #${comp.ultimo_proforma_numero}`}
                              </span>
                              {comp.precio_catalogo_actual != null && comp.diferencia_pct != null && (
                                <span className={`flex items-center gap-0.5 font-semibold ${
                                  comp.tendencia === 'subio' ? 'text-green-600' : comp.tendencia === 'bajo' ? 'text-red-500' : 'text-gray-400'
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
                                <p className="text-[11px] text-gray-300">Sin historial de precio con este cliente</p>
                                {l.producto?.codigo && (
                                  <button
                                    onClick={() => setAgregandoPrecioCodigo(l.producto!.codigo)}
                                    className="text-[11px] text-[#1E3A5F] hover:underline font-medium"
                                  >
                                    + Agregar precio de referencia
                                  </button>
                                )}
                              </div>
                              {comp.otros_clientes.length > 0 && (
                                <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-gray-400">
                                  <Users size={10} className="flex-shrink-0" />
                                  {comp.otros_clientes.map((oc, i) => (
                                    <span key={i}>
                                      {oc.cliente_nombre}: <strong className="text-gray-500">{formatUSD(oc.precio_cliente_usd)}</strong>
                                      {oc.fecha_proforma && ` (${fechaCorta(oc.fecha_proforma)})`}
                                      {i < comp.otros_clientes.length - 1 && ' ·'}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : null
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-600 flex-shrink-0">×{l.cantidad}</span>
                    </div>
                  )
                })}
              </div>

              {seleccionada.notas_cliente && (
                <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 mb-3">
                  <p className="text-xs font-semibold text-yellow-700 mb-1">Notas del cliente</p>
                  <p className="text-sm text-yellow-800">{seleccionada.notas_cliente}</p>
                </div>
              )}

              {seleccionada.motivo_devolucion && seleccionada.estado === 'devuelta' && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Observación enviada al cliente</p>
                  <p className="text-sm text-amber-800 mb-2">{seleccionada.motivo_devolucion}</p>
                  {seleccionada.token_edicion && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/solicitud-editar/${seleccionada.token_edicion}`)
                        setCopiadoId(seleccionada.id)
                        setTimeout(() => setCopiadoId(null), 2000)
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-amber-200 hover:bg-amber-100 text-amber-700"
                    >
                      {copiadoId === seleccionada.id ? (
                        <><CheckCircle2 size={13} className="text-green-600" /> Copiado</>
                      ) : (
                        <><Copy size={13} /> Copiar link para el cliente</>
                      )}
                    </button>
                  )}
                </div>
              )}

              {seleccionada.eventos && seleccionada.eventos.length > 0 && (
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                    <Clock size={12} /> Historial
                  </p>
                  <div className="space-y-2">
                    {[...seleccionada.eventos]
                      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                      .map(ev => (
                        <div key={ev.id} className="text-xs text-gray-600">
                          <span className="font-semibold">{ev.tipo === 'devuelta' ? 'Devuelta al cliente' : 'Cliente reenvió'}</span>
                          {' · '}{fechaCorta(ev.created_at)}
                          {ev.comentario && <p className="text-gray-500 mt-0.5">{ev.comentario}</p>}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {puedeEditar && (seleccionada.estado === 'pendiente' || seleccionada.estado === 'revisada') && (
              <div className="p-5 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => convertir(seleccionada)}
                  disabled={convirtiendo}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: '#1E3A5F' }}
                >
                  <Check size={16} />
                  {convirtiendo ? 'Convirtiendo...' : 'Convertir a proforma'}
                </button>
                <button
                  onClick={() => setShowDevolver(true)}
                  className="px-4 py-2.5 rounded-xl border border-amber-200 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-1.5"
                >
                  <Undo2 size={15} /> Devolver
                </button>
                <button
                  onClick={() => descartar(seleccionada)}
                  className="px-4 py-2.5 rounded-xl border text-sm text-gray-500 hover:bg-gray-50"
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

      {/* Modal devolver con observación */}
      {showDevolver && seleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Devolver pedido al cliente</h2>
              <button onClick={() => setShowDevolver(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-500 mb-3">
                {seleccionada.cliente?.nombre} recibirá un link para revisar y editar su pedido con tu observación.
              </p>
              <textarea
                autoFocus
                value={comentarioDevolver}
                onChange={e => setComentarioDevolver(e.target.value)}
                placeholder="Ej: ¿confirmas el color blanco para el modelo TZ-0425HS?"
                className="w-full border border-gray-200 rounded-lg p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3">
              <button
                onClick={devolver}
                disabled={devolviendo || !comentarioDevolver.trim()}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: '#D4A017', color: '#1E3A5F' }}
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Links de pedido por cliente</h2>
              <button onClick={() => setShowLinks(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-2 max-h-[70vh] overflow-y-auto">
              <p className="text-xs text-gray-400 mb-3">
                Cada cliente tiene 2 links fijos — uno con precio mayorista y otro con precio
                detallista, según cuál le quieras compartir. Cada uno siempre lleva a su
                formulario de pedido con esos precios.
              </p>

              {!puedeEditar ? null : !showNuevoCliente ? (
                <button
                  onClick={() => setShowNuevoCliente(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-lg border border-dashed border-gray-200 text-gray-500 hover:border-[#1E3A5F] hover:text-[#1E3A5F] mb-3"
                >
                  <Plus size={14} /> Nuevo cliente
                </button>
              ) : (
                <div className="border border-gray-200 rounded-lg p-3 mb-3 space-y-2 bg-gray-50">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Nombre del cliente"
                    value={nombreNuevo}
                    onChange={e => setNombreNuevo(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="País (opcional)"
                      value={paisNuevo}
                      onChange={e => setPaisNuevo(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                    />
                    <select
                      value={tipoNuevo}
                      onChange={e => setTipoNuevo(e.target.value as 'mayorista' | 'detallista')}
                      className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                    >
                      <option value="mayorista">Mayorista</option>
                      <option value="detallista">Detallista</option>
                    </select>
                  </div>
                  {errorNuevoCliente && <p className="text-xs text-red-500">{errorNuevoCliente}</p>}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => { setShowNuevoCliente(false); setErrorNuevoCliente('') }}
                      className="flex-1 text-xs font-semibold py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={crearCliente}
                      disabled={!nombreNuevo.trim() || creandoCliente}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg text-white disabled:opacity-40"
                      style={{ background: '#1E3A5F' }}
                    >
                      {creandoCliente && <Loader2 size={13} className="animate-spin" />}
                      Crear cliente
                    </button>
                  </div>
                </div>
              )}

              {clientes.map(c => (
                <div key={c.id} className="border border-gray-100 rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-700">{c.nombre}</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        {c.contacto_email ? (
                          <span className="flex items-center gap-1 text-[11px] text-green-600 truncate">
                            <Mail size={10} /> {c.contacto_email}
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-500">Sin correo de contacto</span>
                        )}
                        {puedeEditar && (
                          <button
                            onClick={() => editandoContactoId === c.id ? setEditandoContactoId(null) : abrirEditarContacto(c)}
                            className="text-gray-300 hover:text-[#1E3A5F] flex-shrink-0"
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
                        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
                      >
                        {copiadoId === c.id && copiadoTipo === 'mayorista' ? (
                          <><CheckCircle2 size={13} className="text-green-600" /> Copiado</>
                        ) : (
                          <><Copy size={13} /> Mayorista</>
                        )}
                      </button>
                      <button
                        onClick={() => copiarLink(c, 'detallista')}
                        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
                      >
                        {copiadoId === c.id && copiadoTipo === 'detallista' ? (
                          <><CheckCircle2 size={13} className="text-green-600" /> Copiado</>
                        ) : (
                          <><Copy size={13} /> Detallista</>
                        )}
                      </button>
                    </div>
                  </div>

                  {editandoContactoId === c.id && (
                    <div className="mt-2.5 pt-2.5 border-t border-gray-100 space-y-2">
                      <input
                        type="text"
                        placeholder="Nombre de contacto"
                        value={contactoForm.contacto_nombre}
                        onChange={e => setContactoForm(f => ({ ...f, contacto_nombre: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                      />
                      <input
                        type="email"
                        placeholder="Correo"
                        value={contactoForm.contacto_email}
                        onChange={e => setContactoForm(f => ({ ...f, contacto_email: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Teléfono"
                          value={contactoForm.contacto_telefono}
                          onChange={e => setContactoForm(f => ({ ...f, contacto_telefono: e.target.value }))}
                          className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                        />
                        <input
                          type="text"
                          placeholder="Dirección"
                          value={contactoForm.direccion}
                          onChange={e => setContactoForm(f => ({ ...f, direccion: e.target.value }))}
                          className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                        />
                      </div>
                      {errorContacto && <p className="text-[11px] text-red-500">{errorContacto}</p>}
                      <div className="flex gap-2 pt-0.5">
                        <button
                          onClick={() => setEditandoContactoId(null)}
                          className="flex-1 text-xs font-semibold py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => guardarContactoCliente(c.id)}
                          disabled={guardandoContactoId === c.id}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-lg text-white disabled:opacity-40"
                          style={{ background: '#1E3A5F' }}
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
