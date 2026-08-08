'use client'
import { useState, useEffect, useRef } from 'react'
import { X, Loader2, ImagePlus } from 'lucide-react'

interface Categoria { id: string; nombre: string; orden: number }

export interface ProductoCreado {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  imagen_url: string | null
  precio_fob_usd: number | null
  precio_mayorista: number | null
  precio_detallista: number | null
  categoria: { id: string; nombre: string } | null
}

export interface ProductoParaEditar {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  imagen_url: string | null
  precio_fob_usd: number | null
  precio_mayorista: number | null
  precio_detallista: number | null
  cbm_unitario: number | null
  moq: number | null
  dimensiones: { largo_mm?: number; ancho_mm?: number; alto_mm?: number } | null
  notas: string | null
  categoria: { id: string; nombre: string } | null
}

export default function NuevoProductoModal({
  onClose,
  onSaved,
  producto,
}: {
  onClose: () => void
  onSaved: (producto: ProductoCreado) => void
  producto?: ProductoParaEditar | null
}) {
  const editando = !!producto
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [codigo, setCodigo] = useState(producto?.codigo || '')
  const [nombre, setNombre] = useState(producto?.nombre || '')
  const [descripcion, setDescripcion] = useState(producto?.descripcion || '')
  const [categoriaId, setCategoriaId] = useState(producto?.categoria?.id || '')
  const [precioFob, setPrecioFob] = useState(producto?.precio_fob_usd?.toString() || '')
  const [precioMayorista, setPrecioMayorista] = useState(producto?.precio_mayorista?.toString() || '')
  const [precioDetallista, setPrecioDetallista] = useState(producto?.precio_detallista?.toString() || '')
  const [cbm, setCbm] = useState(producto?.cbm_unitario?.toString() || '')
  const [moq, setMoq] = useState(producto?.moq?.toString() || '')
  const [largoMm, setLargoMm] = useState(producto?.dimensiones?.largo_mm?.toString() || '')
  const [anchoMm, setAnchoMm] = useState(producto?.dimensiones?.ancho_mm?.toString() || '')
  const [altoMm, setAltoMm] = useState(producto?.dimensiones?.alto_mm?.toString() || '')
  const [notas, setNotas] = useState(producto?.notas || '')
  const [imagen, setImagen] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(producto?.imagen_url || null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/categorias').then(r => r.json()).then(({ data }) => setCategorias(data || []))
  }, [])

  function elegirImagen(file: File | null) {
    setImagen(file)
    setPreviewUrl(file ? URL.createObjectURL(file) : null)
  }

  async function guardar() {
    setError('')
    if (!codigo.trim()) { setError('El código es obligatorio'); return }
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }

    setGuardando(true)
    const fd = new FormData()
    fd.set('codigo', codigo.trim())
    fd.set('nombre', nombre.trim())
    if (descripcion.trim()) fd.set('descripcion', descripcion.trim())
    if (categoriaId) fd.set('categoria_id', categoriaId)
    if (precioFob) fd.set('precio_fob_usd', precioFob)
    if (precioMayorista) fd.set('precio_mayorista', precioMayorista)
    if (precioDetallista) fd.set('precio_detallista', precioDetallista)
    if (cbm) fd.set('cbm_unitario', cbm)
    if (moq) fd.set('moq', moq)
    if (largoMm) fd.set('largo_mm', largoMm)
    if (anchoMm) fd.set('ancho_mm', anchoMm)
    if (altoMm) fd.set('alto_mm', altoMm)
    if (notas.trim()) fd.set('notas', notas.trim())
    if (imagen) fd.set('imagen', imagen)

    const url = editando ? `/api/productos/${producto!.id}` : '/api/productos'
    const res = await fetch(url, { method: editando ? 'PATCH' : 'POST', body: fd })
    const json = await res.json()
    setGuardando(false)

    if (!res.ok) {
      setError(json.error || `Error al ${editando ? 'guardar' : 'crear'} el producto`)
      return
    }
    onSaved(json.data)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-none">
          <h3 className="font-bold text-[#1E3A5F]">{editando ? 'Editar Producto' : 'Nuevo Producto'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 flex-none rounded-lg border-2 border-dashed border-gray-200 hover:border-[#1E3A5F] flex items-center justify-center overflow-hidden bg-gray-50"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="" className="w-full h-full object-contain" />
              ) : (
                <ImagePlus size={22} className="text-gray-300" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => elegirImagen(e.target.files?.[0] || null)}
            />
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Código *</label>
                <input
                  value={codigo}
                  onChange={e => setCodigo(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                  placeholder="ej. TZ-1234"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Categoría</label>
                <select
                  value={categoriaId}
                  onChange={e => setCategoriaId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                >
                  <option value="">Sin categoría</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500">Nombre *</label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
              placeholder="ej. Vessel Sink Round White"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500">Descripción</label>
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500">FOB China (USD)</label>
              <input type="number" step="0.01" value={precioFob} onChange={e => setPrecioFob(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Precio Mayorista</label>
              <input type="number" step="0.01" value={precioMayorista} onChange={e => setPrecioMayorista(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Precio Detallista</label>
              <input type="number" step="0.01" value={precioDetallista} onChange={e => setPrecioDetallista(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500">MOQ</label>
              <input type="number" value={moq} onChange={e => setMoq(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">CBM unitario</label>
              <input type="number" step="0.0001" value={cbm} onChange={e => setCbm(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500">Dimensiones (mm)</label>
            <div className="grid grid-cols-3 gap-3 mt-1">
              <input type="number" placeholder="Largo" value={largoMm} onChange={e => setLargoMm(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]" />
              <input type="number" placeholder="Ancho" value={anchoMm} onChange={e => setAnchoMm(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]" />
              <input type="number" placeholder="Alto" value={altoMm} onChange={e => setAltoMm(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500">Notas internas</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 flex-none">
          <button
            onClick={onClose}
            disabled={guardando}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 disabled:opacity-60"
            style={{ background: '#1E3A5F' }}
          >
            {guardando && <Loader2 size={14} className="animate-spin" />}
            {editando ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </div>
      </div>
    </div>
  )
}
