'use client'
import { useState, useEffect, useCallback } from 'react'
import { X, Package, Pencil, Tag, Plus, Loader2, Sparkles, CheckCircle2 } from 'lucide-react'
import { formatUSD } from '@/lib/precio'

interface Dimensiones { largo_mm?: number; ancho_mm?: number; alto_mm?: number }

interface FichaTecnica { campos: { label: string; valor: string }[] }

interface PrecioEspecialFila {
  id: string
  cliente_id: string
  precio_usd: number
  motivo: string | null
  cliente: { nombre: string } | null
}

export interface ProductoDetalleInterno {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  imagen_url: string | null
  dimensiones: Dimensiones | null
  precio_fob_usd: number | null
  precio_mayorista: number | null
  precio_detallista: number | null
  cbm_unitario: number | null
  moq: number | null
  notas: string | null
  categoria: { id: string; nombre: string } | null
  tiene_historial: boolean
  veces_vendido: number | null
  descripcion_larga_es?: string | null
  descripcion_larga_en?: string | null
  ficha_tecnica?: FichaTecnica | null
  ficha_tecnica_estado?: 'borrador' | 'aprobada' | null
}

export default function ProductoDetalleInternoModal({
  producto,
  onClose,
  onEditar,
  onFijarPrecioEspecial,
  puedeEditar,
  refrescarPrecios,
}: {
  producto: ProductoDetalleInterno
  onClose: () => void
  onEditar?: () => void
  onFijarPrecioEspecial?: () => void
  puedeEditar?: boolean
  refrescarPrecios?: number
}) {
  const [estadoFicha, setEstadoFicha] = useState(producto.ficha_tecnica_estado)
  const [aprobando, setAprobando] = useState(false)

  async function aprobarFicha() {
    setAprobando(true)
    const res = await fetch(`/api/productos/${producto.id}/aprobar-ficha`, { method: 'POST' })
    if (res.ok) setEstadoFicha('aprobada')
    setAprobando(false)
  }
  const dim = producto.dimensiones
  const dimTexto = dim && (dim.largo_mm || dim.ancho_mm || dim.alto_mm)
    ? [dim.largo_mm, dim.ancho_mm, dim.alto_mm].filter(Boolean).join(' × ') + ' mm'
    : null

  const [preciosEspeciales, setPreciosEspeciales] = useState<PrecioEspecialFila[]>([])
  const [cargandoPrecios, setCargandoPrecios] = useState(true)
  const [quitando, setQuitando] = useState<string | null>(null)

  const cargarPreciosEspeciales = useCallback(() => {
    setCargandoPrecios(true)
    fetch(`/api/productos/${producto.id}/precios-especiales`)
      .then(r => r.json())
      .then(({ data }) => { setPreciosEspeciales(data || []); setCargandoPrecios(false) })
      .catch(() => setCargandoPrecios(false))
  }, [producto.id])

  useEffect(() => { cargarPreciosEspeciales() }, [cargarPreciosEspeciales, refrescarPrecios])

  async function quitarPrecioEspecial(fila: PrecioEspecialFila) {
    setQuitando(fila.id)
    await fetch(`/api/clientes/${fila.cliente_id}/precios-especiales/${fila.id}`, { method: 'PATCH' })
    setQuitando(null)
    cargarPreciosEspeciales()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 flex-none">
          <div>
            <p className="font-mono text-xs font-bold text-[#1E3A5F]">{producto.codigo}</p>
            <h2 className="text-lg font-bold text-gray-800 leading-tight mt-0.5">{producto.nombre}</h2>
            {producto.categoria && <p className="text-xs text-gray-400 mt-0.5">{producto.categoria.nombre}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1.5 flex-shrink-0"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="bg-gray-50 h-56 flex items-center justify-center overflow-hidden">
            {producto.imagen_url ? (
              <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-contain p-4" />
            ) : (
              <Package size={44} className="text-gray-300" />
            )}
          </div>

          <div className="p-5 space-y-5">
            {/* Precios */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">FOB China</p>
                <p className="text-sm font-bold text-gray-800">
                  {producto.precio_fob_usd != null ? formatUSD(producto.precio_fob_usd) : '—'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Mayorista</p>
                <p className="text-sm font-bold text-[#1E3A5F]">
                  {producto.precio_mayorista != null ? formatUSD(producto.precio_mayorista) : '—'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Detallista</p>
                <p className="text-sm font-bold text-[#1E3A5F]">
                  {producto.precio_detallista != null ? formatUSD(producto.precio_detallista) : '—'}
                </p>
              </div>
            </div>

            {producto.descripcion && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Descripción</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{producto.descripcion}</p>
              </div>
            )}

            {(producto.descripcion_larga_es || (producto.ficha_tecnica?.campos?.length ?? 0) > 0) && (
              <div className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles size={12} className="text-[#1E3A5F]" /> Ficha técnica
                  </p>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                      estadoFicha === 'aprobada'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}
                  >
                    {estadoFicha === 'aprobada' ? 'Aprobada' : 'Borrador'}
                  </span>
                </div>

                {producto.descripcion_larga_es && (
                  <p className="text-sm text-gray-700 leading-relaxed mb-3">{producto.descripcion_larga_es}</p>
                )}

                {(producto.ficha_tecnica?.campos?.length ?? 0) > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {producto.ficha_tecnica!.campos.map((c, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-2">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{c.label}</p>
                        <p className="text-xs font-medium text-gray-800">{c.valor}</p>
                      </div>
                    ))}
                  </div>
                )}

                {puedeEditar && estadoFicha !== 'aprobada' && (
                  <button
                    onClick={aprobarFicha}
                    disabled={aprobando}
                    className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                  >
                    <CheckCircle2 size={13} />
                    {aprobando ? 'Aprobando...' : 'Aprobar — mostrar al cliente'}
                  </button>
                )}
              </div>
            )}

            {(dimTexto || producto.moq != null || producto.cbm_unitario != null) && (
              <div className="grid grid-cols-2 gap-3">
                {dimTexto && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Dimensiones</p>
                    <p className="text-sm font-medium text-gray-800">{dimTexto}</p>
                  </div>
                )}
                {producto.moq != null && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">MOQ</p>
                    <p className="text-sm font-medium text-gray-800">{producto.moq}</p>
                  </div>
                )}
                {producto.cbm_unitario != null && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">CBM unitario</p>
                    <p className="text-sm font-medium text-gray-800">{producto.cbm_unitario}</p>
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Historial de venta</p>
              {producto.tiene_historial ? (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                  Con historial{producto.veces_vendido ? ` · ${producto.veces_vendido}x` : ''}
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-50 text-gray-400 border border-gray-100">
                  Sin historial
                </span>
              )}
            </div>

            {producto.notas && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide mb-1">Notas internas</p>
                <p className="text-sm text-amber-700 whitespace-pre-line">{producto.notas}</p>
              </div>
            )}

            {(puedeEditar || preciosEspeciales.length > 0) && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                  Precios especiales por cliente
                </p>
                {cargandoPrecios ? (
                  <Loader2 size={16} className="animate-spin text-gray-300" />
                ) : (
                  <div className="space-y-1.5">
                    {preciosEspeciales.map(fila => (
                      <div
                        key={fila.id}
                        className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Tag size={12} className="text-amber-500 flex-shrink-0" />
                          <span className="text-sm text-gray-800 truncate">
                            {fila.cliente?.nombre || 'Cliente'}:{' '}
                            <strong className="text-amber-700">{formatUSD(fila.precio_usd)}</strong>
                            {fila.motivo && <span className="text-gray-400"> — {fila.motivo}</span>}
                          </span>
                        </div>
                        {puedeEditar && (
                          <button
                            onClick={() => quitarPrecioEspecial(fila)}
                            disabled={quitando === fila.id}
                            className="text-xs text-gray-400 hover:text-red-500 hover:underline flex-shrink-0 disabled:opacity-50"
                          >
                            {quitando === fila.id ? 'Quitando...' : 'Quitar'}
                          </button>
                        )}
                      </div>
                    ))}
                    {puedeEditar && (
                      <button
                        onClick={onFijarPrecioEspecial}
                        className="flex items-center gap-1.5 text-sm text-[#1E3A5F] font-medium hover:underline mt-1"
                      >
                        <Plus size={14} /> Fijar precio especial para otro cliente
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {onEditar && (
          <div className="p-5 border-t border-gray-100 flex-none">
            <button
              onClick={onEditar}
              className="w-full py-3 rounded-lg font-bold text-white text-sm flex items-center justify-center gap-2"
              style={{ background: '#1E3A5F' }}
            >
              <Pencil size={14} /> Editar producto
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
