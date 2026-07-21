'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Inbox, Package, Link as LinkIcon, Check, X, ChevronRight,
  Copy, CheckCircle2,
} from 'lucide-react'

interface Cliente { id: string; nombre: string; token_solicitud: string }
interface Producto { id: string; codigo: string; nombre: string; imagen_url: string | null }
interface SolicitudLinea {
  id: string
  producto_id: string | null
  descripcion_libre: string | null
  cantidad: number
  producto: Producto | null
}
interface Solicitud {
  id: string
  estado: 'pendiente' | 'revisada' | 'convertida' | 'descartada'
  notas_cliente: string | null
  created_at: string
  cliente: { id: string; nombre: string } | null
  lineas: SolicitudLinea[]
}

const ESTADO_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  pendiente:  { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pendiente' },
  revisada:   { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Revisada' },
  convertida: { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Convertida' },
  descartada: { bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'Descartada' },
}

function fechaCorta(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function SolicitudesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [estadoFiltro, setEstadoFiltro] = useState('pendiente')
  const [seleccionada, setSeleccionada] = useState<Solicitud | null>(null)
  const [convirtiendo, setConvirtiendo] = useState(false)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const [showLinks, setShowLinks] = useState(false)

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

  function copiarLink(cliente: Cliente) {
    const url = `${window.location.origin}/solicitud/${cliente.token_solicitud}`
    navigator.clipboard.writeText(url)
    setCopiadoId(cliente.id)
    setTimeout(() => setCopiadoId(null), 2000)
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

  const estadosDisponibles = [
    { label: 'Pendientes', value: 'pendiente' },
    { label: 'Revisadas', value: 'revisada' },
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
                {seleccionada.lineas.map(l => (
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
                    </div>
                    <span className="text-sm font-semibold text-gray-600 flex-shrink-0">×{l.cantidad}</span>
                  </div>
                ))}
              </div>

              {seleccionada.notas_cliente && (
                <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-yellow-700 mb-1">Notas del cliente</p>
                  <p className="text-sm text-yellow-800">{seleccionada.notas_cliente}</p>
                </div>
              )}
            </div>

            {seleccionada.estado !== 'convertida' && seleccionada.estado !== 'descartada' && (
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
            <div className="p-5 space-y-2">
              <p className="text-xs text-gray-400 mb-3">
                Cada cliente tiene un link fijo — compártelo una sola vez, siempre llevará a su formulario de pedido.
              </p>
              {clientes.map(c => (
                <div key={c.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2.5">
                  <span className="text-sm font-medium text-gray-700">{c.nombre}</span>
                  <button
                    onClick={() => copiarLink(c)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
                  >
                    {copiadoId === c.id ? (
                      <><CheckCircle2 size={13} className="text-green-600" /> Copiado</>
                    ) : (
                      <><Copy size={13} /> Copiar link</>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
