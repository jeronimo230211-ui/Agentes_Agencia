'use client'
import { useState, useEffect } from 'react'
import { X, Package, Ruler, Palette, Boxes } from 'lucide-react'
import QuantityStepper from './QuantityStepper'
import { formatUSD } from '@/lib/precio'

export interface ProductoDetalle {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  imagen_url: string | null
  imagenes_urls?: string[] | null
  dimensiones?: string | null
  color_variante?: string | null
  moq?: string | null
  precio_cliente?: number | null
}

interface Props {
  producto: ProductoDetalle
  cantidadActual: number
  onConfirmar: (cantidad: number) => void
  onClose: () => void
}

export default function ProductoDetalleModal({ producto, cantidadActual, onConfirmar, onClose }: Props) {
  const [cantidad, setCantidad] = useState(cantidadActual > 0 ? cantidadActual : 1)

  const galeria = [producto.imagen_url, ...(producto.imagenes_urls || [])].filter((u): u is string => !!u)
  const [imagenActiva, setImagenActiva] = useState(galeria[0] || null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const specs = [
    producto.dimensiones ? { icon: Ruler, label: 'Dimensions', valor: producto.dimensiones } : null,
    producto.color_variante ? { icon: Palette, label: 'Color / Variant', valor: producto.color_variante } : null,
    producto.moq ? { icon: Boxes, label: 'MOQ', valor: producto.moq } : null,
  ].filter((s): s is { icon: typeof Ruler; label: string; valor: string } => s !== null)

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4"
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
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1.5 flex-shrink-0"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="bg-gray-50 h-64 flex items-center justify-center overflow-hidden">
            {imagenActiva ? (
              <img src={imagenActiva} alt={producto.nombre} className="w-full h-full object-contain p-4" />
            ) : (
              <Package size={48} className="text-gray-300" />
            )}
          </div>

          {galeria.length > 1 && (
            <div className="flex gap-2 px-5 pt-3 overflow-x-auto">
              {galeria.map((url, i) => (
                <button
                  key={url + i}
                  onClick={() => setImagenActiva(url)}
                  className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 bg-gray-50"
                  style={{ borderColor: imagenActiva === url ? '#1E3A5F' : 'transparent' }}
                >
                  <img src={url} alt="" className="w-full h-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}

          <div className="p-5 space-y-5">
            {producto.precio_cliente != null && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Price</p>
                <p className="text-2xl font-bold" style={{ color: '#1E3A5F' }}>{formatUSD(producto.precio_cliente)}</p>
              </div>
            )}

            {producto.descripcion && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Description</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{producto.descripcion}</p>
              </div>
            )}

            {specs.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {specs.map(({ icon: Icon, label, valor }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                      <Icon size={13} />
                      <p className="text-[11px] font-semibold uppercase tracking-wide">{label}</p>
                    </div>
                    <p className="text-sm font-medium text-gray-800">{valor}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 flex-none flex items-center justify-between gap-4">
          <QuantityStepper value={cantidad} onChange={v => setCantidad(Math.max(1, v))} size="md" min={1} />
          <button
            onClick={() => onConfirmar(cantidad)}
            className="flex-1 py-3 rounded-lg font-bold text-white text-sm"
            style={{ background: '#1E3A5F' }}
          >
            {cantidadActual > 0 ? 'Update quantity' : 'Add to order'}
          </button>
        </div>
      </div>
    </div>
  )
}
