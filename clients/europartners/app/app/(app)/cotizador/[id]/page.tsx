'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, Send, Eye, Loader2,
  CheckCircle, XCircle, AlertCircle, ArrowLeft,
  Search, X, Package, FileText,
  TrendingUp, TrendingDown, Minus, History, Users,
} from 'lucide-react'
import Link from 'next/link'
import { useRol } from '@/lib/useRol'
import { formatUSD, formatPct, calcMargen, precioPorTipo } from '@/lib/precio'
import type { Proforma, ProformaLinea, TipoPrecio } from '@/types/europartners'
import NuevoProductoModal, { type ProductoCreado } from '@/components/NuevoProductoModal'
import AgregarPrecioReferenciaModal from '@/components/AgregarPrecioReferenciaModal'

interface OtroClienteReferencia {
  cliente_nombre: string
  tipo: TipoPrecio
  precio_cliente_usd: number
  fecha_proforma: string | null
  proforma_numero: string | null
}
interface ComparacionPrecio {
  codigo: string
  tiene_historial: boolean
  ultimo_precio_cliente: number | null
  ultima_fecha: string | null
  ultimo_proforma_numero: string | null
  precio_catalogo_actual: number | null
  diferencia_pct: number | null
  tendencia: 'subio' | 'bajo' | 'igual' | 'sin_datos'
  otros_clientes: OtroClienteReferencia[]
}

function fechaCorta(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Categoria { id: string; nombre: string; orden: number }

interface ProductoOpcion {
  id: string
  codigo: string
  descripcion: string
  imagen_url?: string | null
  precio_fob_usd: number
  precio_mayorista?: number
  precio_detallista?: number
  categoria: { nombre: string }
}

interface LineaEditable extends Partial<ProformaLinea> {
  _key: string
  _cantidadStr: string
  _precioMayorista?: number
  _precioDetallista?: number
}

const labelTipo = (t: TipoPrecio) => (t === 'mayorista' ? 'Mayorista' : 'Detallista')

// ─── Selector de Producto ─────────────────────────────────────────────────────
function SelectorProductoModal({
  tipoPrecio,
  onSelect,
  onClose,
  onNuevoProducto,
}: {
  tipoPrecio: TipoPrecio
  onSelect: (p: ProductoOpcion) => void
  onClose: () => void
  onNuevoProducto: () => void
}) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaId, setCategoriaId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [productos, setProductos] = useState<ProductoOpcion[]>([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    fetch('/api/categorias').then(r => r.json()).then(({ data }) => setCategorias(data || []))
  }, [])

  useEffect(() => {
    setCargando(true)
    const params = new URLSearchParams({ limit: '50' })
    if (categoriaId) params.set('categoria_id', categoriaId)
    if (busqueda) params.set('q', busqueda)
    fetch(`/api/productos?${params}`)
      .then(r => r.json())
      .then(({ data }) => { setProductos(data || []); setCargando(false) })
  }, [categoriaId, busqueda])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '80vh' }}>
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-none">
          <h3 className="font-bold text-[#1E3A5F]">Seleccionar Producto</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={onNuevoProducto}
              className="flex items-center gap-1 text-sm font-medium text-[#1E3A5F] hover:underline"
            >
              <Plus size={14} /> Nuevo producto
            </button>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="p-4 border-b border-gray-100 flex gap-3 flex-none">
          <select
            value={categoriaId}
            onChange={e => setCategoriaId(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] w-44"
          >
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Código o descripción..."
              className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1">
          {cargando ? (
            <div className="p-10 text-center">
              <Loader2 size={24} className="animate-spin mx-auto text-gray-400" />
            </div>
          ) : productos.length === 0 ? (
            <div className="p-10 text-center">
              <Package size={36} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-500 text-sm font-medium">Sin productos que coincidan</p>
              <button
                onClick={onNuevoProducto}
                className="mt-4 inline-flex items-center gap-1 text-sm text-[#1E3A5F] underline"
              >
                <Plus size={14} /> Crear un producto nuevo
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  <th className="p-3 w-12"></th>
                  <th className="text-left p-3 font-medium text-gray-500">Código</th>
                  <th className="text-left p-3 font-medium text-gray-500">Descripción</th>
                  <th className="text-right p-3 font-medium text-gray-500">FOB China</th>
                  <th className="text-right p-3 font-medium text-gray-500">
                    P. Cliente ({labelTipo(tipoPrecio)})
                  </th>
                </tr>
              </thead>
              <tbody>
                {productos.map(p => {
                  const precioSugerido = precioPorTipo(p.precio_mayorista, p.precio_detallista, tipoPrecio)
                  return (
                    <tr
                      key={p.id}
                      onClick={() => onSelect(p)}
                      className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td className="p-2 pl-3">
                        <div className="w-9 h-9 rounded-md bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {p.imagen_url ? (
                            <img src={p.imagen_url} alt="" loading="lazy" className="w-full h-full object-contain" />
                          ) : (
                            <Package size={14} className="text-gray-300" />
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs text-gray-600">
                        {p.codigo || '—'}
                      </td>
                      <td className="p-3">{p.descripcion}</td>
                      <td className="p-3 text-right text-gray-500">{formatUSD(p.precio_fob_usd || 0)}</td>
                      <td className="p-3 text-right font-medium text-[#1E3A5F]">
                        {precioSugerido !== undefined ? formatUSD(precioSugerido) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Modal cambio de tipo de precio ────────────────────────────────────────────
function ModalCambioTipoPrecio({
  actual,
  nuevo,
  lineas,
  onCancel,
  onConfirmar,
}: {
  actual: TipoPrecio
  nuevo: TipoPrecio
  lineas: LineaEditable[]
  onCancel: () => void
  onConfirmar: (alcance: 'todas' | string[]) => void
}) {
  const [paso, setPaso] = useState<'alcance' | 'seleccion'>('alcance')
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())

  const lineasConProducto = lineas.filter(l => l.producto_id)
  const lineasSinProducto = lineas.length - lineasConProducto.length

  function toggle(key: string) {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="p-4 border-b border-gray-100 flex-none">
          <h3 className="font-bold text-[#1E3A5F]">Cambiar tipo de precio</h3>
          <p className="text-sm text-gray-500 mt-1">
            Estás a punto de cambiar de <strong>{labelTipo(actual)}</strong> a <strong>{labelTipo(nuevo)}</strong>.
            {paso === 'alcance'
              ? ' ¿Vas a cambiar toda la proforma o deseas cambiar productos específicos?'
              : ' Marca los productos que quieres actualizar al nuevo precio.'}
          </p>
        </div>

        {paso === 'alcance' ? (
          <>
            <div className="p-4 flex flex-col gap-2">
              <button
                onClick={() => onConfirmar('todas')}
                className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-[#1E3A5F] hover:bg-blue-50 transition-colors"
              >
                <p className="font-medium text-gray-800 text-sm">Cambiar toda la proforma</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Recalcula el precio de todas las líneas con producto vinculado
                  {lineasSinProducto > 0 ? ` (${lineasSinProducto} sin producto no se tocan)` : ''}.
                </p>
              </button>
              <button
                onClick={() => setPaso('seleccion')}
                className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-[#1E3A5F] hover:bg-blue-50 transition-colors"
              >
                <p className="font-medium text-gray-800 text-sm">Seleccionar productos específicos</p>
                <p className="text-xs text-gray-500 mt-0.5">Elige uno a uno cuáles líneas actualizar.</p>
              </button>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end flex-none">
              <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="overflow-y-auto flex-1 p-2">
              {lineasConProducto.length === 0 ? (
                <p className="text-sm text-gray-400 text-center p-6">
                  Ninguna línea tiene un producto del catálogo vinculado.
                </p>
              ) : (
                lineasConProducto.map(l => (
                  <label
                    key={l._key}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={seleccionadas.has(l._key)}
                      onChange={() => toggle(l._key)}
                      className="flex-none"
                    />
                    <span className="font-mono text-xs text-gray-500 w-20 flex-none">{l.codigo_pdf || '—'}</span>
                    <span className="text-sm text-gray-700 flex-1 truncate">{l.descripcion_pdf}</span>
                    <span className="text-sm font-medium text-gray-600 flex-none">
                      {formatUSD(l.precio_cliente_usd || 0)}
                    </span>
                  </label>
                ))
              )}
              {lineasSinProducto > 0 && (
                <p className="text-xs text-gray-400 px-3 pt-2">
                  {lineasSinProducto} línea{lineasSinProducto > 1 ? 's' : ''} sin producto vinculado — edítalas a mano si aplica.
                </p>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-between flex-none">
              <div className="flex gap-4">
                <button onClick={() => setPaso('alcance')} className="text-sm text-gray-500 hover:text-gray-700">
                  Atrás
                </button>
                <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
                  Cancelar
                </button>
              </div>
              <button
                onClick={() => onConfirmar(Array.from(seleccionadas))}
                disabled={seleccionadas.size === 0}
                className="px-4 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-40"
                style={{ background: '#1E3A5F' }}
              >
                Aplicar a seleccionados ({seleccionadas.size})
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Editor Principal ─────────────────────────────────────────────────────────
export default function ProformaEditorPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [proforma, setProforma] = useState<Proforma | null>(null)
  const [lineas, setLineas] = useState<LineaEditable[]>([])
  const [tipoPrecio, setTipoPrecio] = useState<TipoPrecio>('mayorista')
  const [cambioTipoPendiente, setCambioTipoPendiente] = useState<TipoPrecio | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [mostrarNuevoProducto, setMostrarNuevoProducto] = useState(false)
  const [lineaParaSelector, setLineaParaSelector] = useState<string | null>(null)
  const [confirmandoPago, setConfirmandoPago] = useState(false)
  const [comparacion, setComparacion] = useState<Record<string, ComparacionPrecio>>({})
  const [agregandoPrecioCodigo, setAgregandoPrecioCodigo] = useState<string | null>(null)
  const { puedeEditar: rolPuedeEditar } = useRol()

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/proformas/${params.id}`)
    const { data } = await res.json()
    if (data) {
      setProforma(data)
      setTipoPrecio(data.tipo_precio || data.cliente?.tipo || 'mayorista')
      setLineas((data.lineas || []).map((l: ProformaLinea) => ({
        ...l,
        _key: l.id,
        _cantidadStr: String(l.cantidad ?? 1),
        _precioMayorista: l.producto?.precio_mayorista,
        _precioDetallista: l.producto?.precio_detallista,
      })))
    }
    setLoading(false)
  }, [params.id])

  useEffect(() => { cargar() }, [cargar])

  const codigosLineas = lineas.map(l => l.codigo_pdf).filter(Boolean).join(',')

  const cargarComparacion = useCallback(() => {
    const clienteId = proforma?.cliente_id
    if (!clienteId || !codigosLineas) { setComparacion({}); return }
    fetch(`/api/clientes/${clienteId}/comparacion-historica?codigos=${encodeURIComponent(codigosLineas)}`)
      .then(r => r.json())
      .then(({ data }) => {
        const porCodigo: Record<string, ComparacionPrecio> = {}
        for (const c of (data?.comparaciones || []) as ComparacionPrecio[]) porCodigo[c.codigo] = c
        setComparacion(porCodigo)
      })
      .catch(() => setComparacion({}))
  }, [proforma?.cliente_id, codigosLineas])

  useEffect(() => { cargarComparacion() }, [cargarComparacion])

  function agregarLinea() {
    const key = `new-${Date.now()}`
    setLineas(prev => [...prev, {
      _key: key,
      _cantidadStr: '1',
      descripcion_pdf: '',
      codigo_pdf: '',
      cantidad: 1,
      precio_costo_usd: undefined,
      precio_cliente_usd: undefined,
      margen_pct: undefined,
    }])
  }

  function actualizarLinea(key: string, campo: string, valor: unknown) {
    setLineas(prev => prev.map(l => {
      if (l._key !== key) return l
      const updated = { ...l, [campo]: valor }

      if (campo === 'precio_cliente_usd' && l.precio_costo_usd) {
        updated.margen_pct = calcMargen(l.precio_costo_usd, valor as number)
      }
      if (campo === 'margen_pct' && l.precio_costo_usd) {
        updated.precio_cliente_usd = Number(l.precio_costo_usd) * (1 + (valor as number))
      }

      return updated
    }))
  }

  function actualizarCantidadStr(key: string, raw: string) {
    setLineas(prev => prev.map(l => {
      if (l._key !== key) return l
      const n = parseInt(raw)
      return {
        ...l,
        _cantidadStr: raw,
        cantidad: isNaN(n) || n < 1 ? l.cantidad : n,
      }
    }))
  }

  function fijarCantidad(key: string) {
    setLineas(prev => prev.map(l => {
      if (l._key !== key) return l
      const n = parseInt(l._cantidadStr)
      const cantidad = isNaN(n) || n < 1 ? 1 : n
      return { ...l, cantidad, _cantidadStr: String(cantidad) }
    }))
  }

  function eliminarLinea(key: string) {
    setLineas(prev => prev.filter(l => l._key !== key))
  }

  function abrirSelector(key: string) {
    setLineaParaSelector(key)
    setSelectorAbierto(true)
  }

  function seleccionarProducto(producto: ProductoOpcion) {
    if (!lineaParaSelector) return
    const precioCosto = producto.precio_fob_usd || 0
    const precioCliente = precioPorTipo(producto.precio_mayorista, producto.precio_detallista, tipoPrecio)

    setLineas(prev => prev.map(l => {
      if (l._key !== lineaParaSelector) return l
      return {
        ...l,
        producto_id: producto.id,
        codigo_pdf: producto.codigo || '',
        descripcion_pdf: producto.descripcion,
        precio_costo_usd: precioCosto,
        precio_cliente_usd: precioCliente,
        margen_pct: precioCliente !== undefined ? calcMargen(precioCosto, precioCliente) : undefined,
        _precioMayorista: producto.precio_mayorista,
        _precioDetallista: producto.precio_detallista,
      }
    }))

    setSelectorAbierto(false)
    setLineaParaSelector(null)
  }

  function productoCreado(producto: ProductoCreado) {
    setMostrarNuevoProducto(false)
    seleccionarProducto({
      id: producto.id,
      codigo: producto.codigo,
      descripcion: producto.descripcion || producto.nombre,
      imagen_url: producto.imagen_url,
      precio_fob_usd: producto.precio_fob_usd || 0,
      precio_mayorista: producto.precio_mayorista ?? undefined,
      precio_detallista: producto.precio_detallista ?? undefined,
      categoria: { nombre: producto.categoria?.nombre || '' },
    })
  }

  function solicitarCambioTipoPrecio(nuevo: TipoPrecio) {
    if (!puedeEditar || nuevo === tipoPrecio) return
    if (lineas.length === 0) {
      setTipoPrecio(nuevo)
      return
    }
    setCambioTipoPendiente(nuevo)
  }

  function aplicarCambioTipo(nuevo: TipoPrecio, alcance: 'todas' | string[]) {
    const keys = alcance === 'todas' ? null : new Set(alcance)
    setLineas(prev => prev.map(l => {
      if (!l.producto_id) return l
      if (keys && !keys.has(l._key)) return l
      const precioNuevo = precioPorTipo(l._precioMayorista, l._precioDetallista, nuevo)
      if (precioNuevo === undefined) return l
      return {
        ...l,
        precio_cliente_usd: precioNuevo,
        margen_pct: l.precio_costo_usd ? calcMargen(l.precio_costo_usd, precioNuevo) : l.margen_pct,
      }
    }))
    setTipoPrecio(nuevo)
    setCambioTipoPendiente(null)
  }

  async function guardar() {
    if (!proforma) return
    setGuardando(true)
    setError('')

    const lineasData = lineas.map((l, i) => ({
      id: l.id,
      producto_id: l.producto_id,
      variante_id: l.variante_id,
      componente_id: l.componente_id,
      descripcion_pdf: l.descripcion_pdf || '',
      codigo_pdf: l.codigo_pdf || '',
      cantidad: l.cantidad || 1,
      precio_costo_usd: l.precio_costo_usd,
      precio_cliente_usd: l.precio_cliente_usd,
      margen_pct: l.margen_pct,
      subtotal_costo_usd: (l.precio_costo_usd || 0) * (l.cantidad || 1),
      subtotal_cliente_usd: (l.precio_cliente_usd || 0) * (l.cantidad || 1),
      orden: i,
    }))

    const res = await fetch(`/api/proformas/${proforma.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineas: lineasData, tipo_precio: tipoPrecio }),
    })

    if (!res.ok) {
      const j = await res.json()
      setError(j.error || 'Error al guardar')
    } else {
      await cargar()
      setGuardadoOk(true)
      setTimeout(() => setGuardadoOk(false), 3000)
    }
    setGuardando(false)
  }

  async function enviarRevision() {
    await guardar()
    setEnviando(true)
    const res = await fetch(`/api/proformas/${proforma!.id}/enviar-revision`, { method: 'POST' })
    if (res.ok) {
      router.push('/cotizador')
    } else {
      const j = await res.json()
      setError(j.error || 'Error al enviar')
    }
    setEnviando(false)
  }

  async function enviarCliente() {
    setEnviando(true)
    const res = await fetch(`/api/proformas/${proforma!.id}/enviar-cliente`, { method: 'POST' })
    if (res.ok) {
      router.push('/cotizador')
    } else {
      const j = await res.json()
      setError(j.error || 'Error al enviar al cliente')
    }
    setEnviando(false)
  }

  async function confirmarPago() {
    if (!proforma) return
    setConfirmandoPago(true)
    const res = await fetch(`/api/proformas/${proforma.id}/confirmar-pago`, { method: 'POST' })
    if (res.ok) {
      const { data } = await res.json()
      setProforma(prev => prev ? { ...prev, estado_pago: data.estado_pago } : prev)
    } else {
      const j = await res.json()
      setError(j.error || 'Error al confirmar el pago')
    }
    setConfirmandoPago(false)
  }

  const totalFob = lineas.reduce((sum, l) => sum + ((l.precio_cliente_usd || 0) * (l.cantidad || 1)), 0)
  const puedeEditar = (proforma?.estado === 'borrador' || proforma?.estado === 'rechazada' || proforma?.estado === 'cambios_solicitados') && rolPuedeEditar
  const puedeEnviarRevision = (proforma?.estado === 'borrador' || proforma?.estado === 'rechazada' || proforma?.estado === 'cambios_solicitados') && puedeEditar && lineas.length > 0
  const puedeEnviarCliente = proforma?.estado === 'aprobada' && rolPuedeEditar

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <Loader2 size={32} className="animate-spin text-[#1E3A5F]" />
      </div>
    )
  }

  if (!proforma) {
    return <div className="p-8 text-red-500">Proforma no encontrada</div>
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Modal Selector */}
      {selectorAbierto && (
        <SelectorProductoModal
          tipoPrecio={tipoPrecio}
          onSelect={seleccionarProducto}
          onClose={() => setSelectorAbierto(false)}
          onNuevoProducto={() => setMostrarNuevoProducto(true)}
        />
      )}

      {mostrarNuevoProducto && (
        <NuevoProductoModal
          onClose={() => setMostrarNuevoProducto(false)}
          onSaved={productoCreado}
        />
      )}

      {/* Modal agregar precio de referencia */}
      {agregandoPrecioCodigo && proforma?.cliente_id && (
        <AgregarPrecioReferenciaModal
          clienteId={proforma.cliente_id}
          codigo={agregandoPrecioCodigo}
          onClose={() => setAgregandoPrecioCodigo(null)}
          onGuardado={() => { setAgregandoPrecioCodigo(null); cargarComparacion() }}
        />
      )}

      {/* Modal cambio de tipo de precio */}
      {cambioTipoPendiente && (
        <ModalCambioTipoPrecio
          actual={tipoPrecio}
          nuevo={cambioTipoPendiente}
          lineas={lineas}
          onCancel={() => setCambioTipoPendiente(null)}
          onConfirmar={(alcance) => aplicarCambioTipo(cambioTipoPendiente, alcance)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/cotizador" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={18} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#1E3A5F]">
              {proforma.numero || 'Nueva Proforma'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {proforma.cliente?.nombre} · {proforma.incoterm} ·{' '}
              <span className={`font-medium ${
                proforma.estado === 'aprobada'    ? 'text-green-600' :
                proforma.estado === 'rechazada'  ? 'text-red-600' :
                proforma.estado === 'en_revision'? 'text-yellow-600' : 'text-gray-600'
              }`}>
                {proforma.estado.replace('_', ' ')}
              </span>
            </p>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          {/* Toast guardado */}
          {guardadoOk && (
            <span className="flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 text-sm font-medium">
              <CheckCircle size={14} />
              Guardado
            </span>
          )}

          {proforma && (
            <a
              href={`/api/proformas/${proforma.id}/pdf`}
              target="_blank"
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              <Eye size={16} />
              Ver PDF
            </a>
          )}

          {puedeEditar && (
            <>
              <button
                onClick={guardar}
                disabled={guardando}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={enviarRevision}
                disabled={!puedeEnviarRevision || enviando}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50"
                style={{ background: '#1E3A5F' }}
              >
                <Send size={16} />
                {enviando ? 'Enviando...' : 'Enviar a Marta'}
              </button>
            </>
          )}

          {puedeEnviarCliente && (
            <button
              onClick={enviarCliente}
              disabled={enviando}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              <Send size={16} />
              {enviando ? 'Enviando...' : 'Enviar al Cliente'}
            </button>
          )}
        </div>
      </div>

      {/* Tipo de precio */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-gray-400 font-medium">Tipo de precio:</span>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
          {(['mayorista', 'detallista'] as TipoPrecio[]).map(t => (
            <button
              key={t}
              type="button"
              disabled={!puedeEditar}
              onClick={() => solicitarCambioTipoPrecio(t)}
              className={`px-3 py-1.5 transition-colors ${
                tipoPrecio === t ? 'text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              } ${!puedeEditar ? 'opacity-60 cursor-not-allowed' : ''}`}
              style={tipoPrecio === t ? { background: '#1E3A5F' } : undefined}
            >
              {labelTipo(t)}
            </button>
          ))}
        </div>
      </div>

      {/* Alertas de estado */}
      {proforma.estado === 'rechazada' && proforma.motivo_rechazo && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex gap-3">
          <XCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800 text-sm">Proforma rechazada</p>
            <p className="text-red-700 text-sm mt-0.5">{proforma.motivo_rechazo}</p>
          </div>
        </div>
      )}
      {proforma.estado === 'en_revision' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 flex gap-3">
          <AlertCircle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-yellow-800 text-sm">Esta proforma está esperando aprobación de Marta.</p>
        </div>
      )}
      {proforma.estado === 'aprobada' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 flex gap-3">
          <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-800 text-sm">Proforma aprobada. Puedes enviarla al cliente.</p>
        </div>
      )}
      {proforma.estado === 'cambios_solicitados' && proforma.comentario_cliente && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex gap-3">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 text-sm">El cliente pidió cambios en esta proforma</p>
            <p className="text-amber-700 text-sm mt-0.5">{proforma.comentario_cliente}</p>
            <p className="text-amber-600 text-xs mt-1">Ajusta las líneas y vuelve a enviarla al cliente.</p>
          </div>
        </div>
      )}

      {/* Comprobante de pago subido por el cliente */}
      {proforma.comprobante_url && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-gray-800 text-sm">Comprobante de pago</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  proforma.estado_pago === 'pagado' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {proforma.estado_pago === 'pagado' ? 'Pagado' : 'Abonado — pendiente de confirmar'}
                </span>
              </div>
              <p className="text-gray-500 text-sm">
                Monto abonado:{' '}
                <span className="font-semibold text-gray-800">
                  {proforma.monto_abono_recibido != null ? formatUSD(proforma.monto_abono_recibido) : 'No especificado por el cliente'}
                </span>
              </p>
              {proforma.fecha_abono && (
                <p className="text-gray-400 text-xs mt-0.5">Subido el {proforma.fecha_abono}</p>
              )}
            </div>
            <a
              href={proforma.comprobante_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 flex flex-col items-center gap-1 group"
            >
              {proforma.comprobante_url.toLowerCase().endsWith('.pdf') ? (
                <div className="w-20 h-20 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center group-hover:bg-gray-100">
                  <FileText size={26} className="text-gray-400" />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={proforma.comprobante_url}
                  alt="Comprobante de pago"
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200 group-hover:opacity-80"
                />
              )}
              <span className="text-xs text-blue-600 underline">Ver comprobante</span>
            </a>
          </div>
          {proforma.estado_pago === 'parcial' && rolPuedeEditar && (
            <button
              onClick={confirmarPago}
              disabled={confirmandoPago}
              className="mt-3 px-4 py-2 rounded-lg text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              {confirmandoPago ? 'Confirmando...' : 'Confirmar pago recibido'}
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm flex items-center gap-2">
          <XCircle size={16} className="flex-none" />
          {error}
        </div>
      )}

      {/* Tabla de líneas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-800">Líneas de la proforma</h2>
            {puedeEditar && (
              <p className="text-xs text-gray-400 mt-0.5">
                Haz clic en <Package size={11} className="inline" /> para buscar del catálogo, o escribe directamente
              </p>
            )}
          </div>
          {puedeEditar && (
            <button
              onClick={agregarLinea}
              className="flex items-center gap-1.5 text-sm text-[#1E3A5F] font-medium hover:bg-blue-50 px-3 py-1.5 rounded-lg"
            >
              <Plus size={16} />
              Agregar línea
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left p-3 font-medium text-gray-500 w-8">#</th>
                <th className="text-left p-3 font-medium text-gray-500 w-28">Código</th>
                <th className="text-left p-3 font-medium text-gray-500">Descripción</th>
                <th className="text-center p-3 font-medium text-gray-500 w-20">Qty</th>
                <th className="text-right p-3 font-medium text-gray-500 w-28">Costo China</th>
                <th className="text-right p-3 font-medium text-gray-500 w-28">P. Cliente</th>
                <th className="text-right p-3 font-medium text-gray-500 w-20">Margen</th>
                <th className="text-right p-3 font-medium text-gray-500 w-28">Total</th>
                {puedeEditar && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {lineas.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center p-8 text-gray-400">
                    {puedeEditar ? 'Agrega productos con el botón de arriba.' : 'Sin líneas.'}
                  </td>
                </tr>
              )}
              {lineas.map((linea, i) => (
                <tr key={linea._key} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                  <td className="p-3 text-gray-400 text-xs">{i + 1}</td>

                  {/* Código */}
                  <td className="p-3">
                    {puedeEditar ? (
                      <div className="flex items-center gap-1">
                        <button
                          title="Buscar en catálogo"
                          onClick={() => abrirSelector(linea._key)}
                          className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-[#1E3A5F] flex-none"
                        >
                          <Package size={14} />
                        </button>
                        <input
                          type="text"
                          value={linea.codigo_pdf || ''}
                          onChange={e => actualizarLinea(linea._key, 'codigo_pdf', e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                          placeholder="TZ-3430"
                        />
                      </div>
                    ) : (
                      <span className="font-mono text-xs text-gray-600">{linea.codigo_pdf}</span>
                    )}
                  </td>

                  {/* Descripción */}
                  <td className="p-3">
                    {puedeEditar ? (
                      <input
                        type="text"
                        value={linea.descripcion_pdf || ''}
                        onChange={e => actualizarLinea(linea._key, 'descripcion_pdf', e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                        placeholder="Descripción del producto"
                      />
                    ) : (
                      <span>{linea.descripcion_pdf}</span>
                    )}
                    {linea.codigo_pdf && comparacion[linea.codigo_pdf] && (() => {
                      const comp = comparacion[linea.codigo_pdf!]
                      return comp.tiene_historial ? (
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[11px]">
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
                      ) : (
                        <div className="mt-1 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[11px] text-gray-300">Sin historial de precio con este cliente</p>
                            <button
                              type="button"
                              onClick={() => setAgregandoPrecioCodigo(linea.codigo_pdf!)}
                              className="text-[11px] text-[#1E3A5F] hover:underline font-medium"
                            >
                              + Agregar precio de referencia
                            </button>
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
                      )
                    })()}
                  </td>

                  {/* Cantidad */}
                  <td className="p-3">
                    {puedeEditar ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={linea._cantidadStr}
                        onChange={e => actualizarCantidadStr(linea._key, e.target.value.replace(/\D/g, ''))}
                        onBlur={() => fijarCantidad(linea._key)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                      />
                    ) : (
                      <span className="text-center block">{linea.cantidad}</span>
                    )}
                  </td>

                  {/* Costo */}
                  <td className="p-3">
                    {puedeEditar ? (
                      <input
                        type="number"
                        value={linea.precio_costo_usd ?? ''}
                        onChange={e => actualizarLinea(linea._key, 'precio_costo_usd', parseFloat(e.target.value) || 0)}
                        step="0.01"
                        placeholder="0.00"
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                      />
                    ) : (
                      <span className="text-right block text-gray-500">{formatUSD(linea.precio_costo_usd || 0)}</span>
                    )}
                  </td>

                  {/* Precio cliente */}
                  <td className="p-3">
                    {puedeEditar ? (
                      <input
                        type="number"
                        value={linea.precio_cliente_usd ?? ''}
                        onChange={e => actualizarLinea(linea._key, 'precio_cliente_usd', parseFloat(e.target.value) || 0)}
                        step="0.01"
                        placeholder="0.00"
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right font-medium focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                      />
                    ) : (
                      <span className="text-right block font-medium">{formatUSD(linea.precio_cliente_usd || 0)}</span>
                    )}
                  </td>

                  {/* Margen */}
                  <td className="p-3">
                    {puedeEditar ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={linea.margen_pct !== undefined ? Math.round((linea.margen_pct) * 100) : ''}
                          onChange={e => actualizarLinea(linea._key, 'margen_pct', (parseFloat(e.target.value) || 0) / 100)}
                          step="1"
                          placeholder="15"
                          className="w-12 border border-gray-200 rounded px-1 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                        />
                        <span className="text-gray-400 text-xs">%</span>
                      </div>
                    ) : (
                      <span className={`text-right block text-xs font-medium ${
                        (linea.margen_pct || 0) < 0.10 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatPct(linea.margen_pct || 0)}
                      </span>
                    )}
                  </td>

                  {/* Total */}
                  <td className="p-3 text-right font-medium text-[#1E3A5F]">
                    {formatUSD((linea.precio_cliente_usd || 0) * (linea.cantidad || 1))}
                  </td>

                  {puedeEditar && (
                    <td className="p-3">
                      <button
                        onClick={() => eliminarLinea(linea._key)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {lineas.length > 0 && (
          <div className="p-4 border-t border-gray-100 flex justify-end">
            <div className="text-right">
              <p className="text-sm text-gray-500">TOTAL {proforma.incoterm || 'FOB'}</p>
              <p className="text-2xl font-bold text-[#1E3A5F]">{formatUSD(totalFob)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Notas internas */}
      {puedeEditar && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="font-medium text-gray-700 mb-2 text-sm">Notas internas (no aparecen en el PDF)</h3>
          <textarea
            value={proforma.notas_internas || ''}
            onChange={e => setProforma(prev => prev ? { ...prev, notas_internas: e.target.value } : prev)}
            placeholder="Comentarios para Marta..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
          />
        </div>
      )}
    </div>
  )
}
