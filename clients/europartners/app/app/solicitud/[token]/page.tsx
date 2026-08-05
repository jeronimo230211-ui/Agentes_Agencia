'use client'
import { useState, useEffect } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import SolicitudForm from '@/components/SolicitudForm'

interface Categoria { id: string; nombre: string }
interface Producto {
  id: string
  categoria_id: string | null
  codigo: string
  nombre: string
  descripcion: string | null
  imagen_url: string | null
}

// Página pública — el cliente entra desde su link fijo de pedido, sin login.
export default function SolicitudPage({ params }: { params: { token: string } }) {
  const [estado, setEstado] = useState<'loading' | 'invalid' | 'ready'>('loading')
  const [clienteNombre, setClienteNombre] = useState('')
  const [contactoCompleto, setContactoCompleto] = useState(true)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])

  useEffect(() => {
    fetch(`/api/solicitud/${params.token}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) {
          setEstado('invalid')
        } else {
          setClienteNombre(json.cliente.nombre)
          setContactoCompleto(!!json.cliente.contactoCompleto)
          setCategorias(json.categorias || [])
          setProductos(json.productos || [])
          setEstado('ready')
        }
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
          <h1 className="text-xl font-bold text-gray-800 mb-2">Invalid link</h1>
          <p className="text-gray-500 text-sm">
            This order link is not valid. Please contact Europartners to get your correct link.
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
      contactoCompleto={contactoCompleto}
      onEnviar={async ({ lineas, notas_cliente }) => {
        const res = await fetch(`/api/solicitud/${params.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notas_cliente, lineas }),
        })
        if (res.ok) return { ok: true }
        const j = await res.json()
        return { ok: false, error: j.error }
      }}
      onGuardarContacto={async datos => {
        const res = await fetch(`/api/solicitud/${params.token}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        })
        if (res.ok) return { ok: true }
        const j = await res.json()
        return { ok: false, error: j.error }
      }}
    />
  )
}
