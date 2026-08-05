'use client'
import { useState, useEffect } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import SolicitudForm, { LineaCarrito } from '@/components/SolicitudForm'

interface Categoria { id: string; nombre: string }
interface Producto {
  id: string
  categoria_id: string | null
  codigo: string
  nombre: string
  descripcion: string | null
  imagen_url: string | null
}
interface SolicitudLineaExistente {
  producto_id: string | null
  descripcion_libre: string | null
  cantidad: number
}

// Página pública — el cliente entra aquí cuando Deisy/Marta le devuelven su
// pedido con una observación (link de un solo uso, enviado por correo o
// compartido manualmente mientras el dominio de correo no esté verificado).
export default function SolicitudEditarPage({ params }: { params: { token: string } }) {
  const [estado, setEstado] = useState<'loading' | 'invalid' | 'ready'>('loading')
  const [clienteNombre, setClienteNombre] = useState('')
  const [motivo, setMotivo] = useState('')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [carritoInicial, setCarritoInicial] = useState<LineaCarrito[]>([])

  useEffect(() => {
    fetch(`/api/solicitud-editar/${params.token}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) {
          setEstado('invalid')
          return
        }
        setClienteNombre(json.cliente.nombre)
        setMotivo(json.motivo_devolucion || '')
        setCategorias(json.categorias || [])
        setProductos(json.productos || [])

        const productosPorId = new Map<string, Producto>((json.productos || []).map((p: Producto) => [p.id, p]))
        const carrito: LineaCarrito[] = (json.lineas || []).map((l: SolicitudLineaExistente, i: number) => {
          if (l.producto_id) {
            const p = productosPorId.get(l.producto_id)
            return { key: l.producto_id, producto_id: l.producto_id, codigo: p?.codigo, nombre: p?.nombre || 'Product', cantidad: l.cantidad }
          }
          return { key: `libre-${i}`, descripcion_libre: l.descripcion_libre || '', nombre: l.descripcion_libre || '', cantidad: l.cantidad }
        })
        setCarritoInicial(carrito)
        setEstado('ready')
      })
      .catch(() => setEstado('invalid'))
  }, [params.token])

  if (estado === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-[#1E3A5F]" size={40} />
      </div>
    )
  }

  if (estado === 'invalid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Link unavailable</h1>
          <p className="text-gray-500 text-sm">
            This link has already been used or is not valid. If you need help, please contact Europartners.
          </p>
        </div>
      </div>
    )
  }

  return (
    <SolicitudForm
      clienteNombre={clienteNombre}
      categorias={categorias}
      productos={productos}
      carritoInicial={carritoInicial}
      banner={motivo}
      subtitulo="Review order"
      tituloExito="Thank you!"
      mensajeExito={() => 'We received your updated order. Europartners will review it and send you the commercial proforma soon.'}
      textoBoton="Resend order to Europartners"
      onEnviar={async ({ lineas, notas_cliente }) => {
        const res = await fetch(`/api/solicitud-editar/${params.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notas_cliente, lineas }),
        })
        if (res.ok) return { ok: true }
        const j = await res.json()
        return { ok: false, error: j.error }
      }}
    />
  )
}
