'use client'
import { createContext, useCallback, useContext, useState } from 'react'
import { LineaCarrito, ProductoParaCarrito, cantidadEnCarrito, fijarCantidadProducto } from './carrito'

interface SolicitudCarritoValue {
  carrito: LineaCarrito[]
  setCarrito: React.Dispatch<React.SetStateAction<LineaCarrito[]>>
  fijarCantidad: (producto: ProductoParaCarrito, cantidad: number) => void
  cantidadDe: (productoId: string) => number
}

const SolicitudCarritoContext = createContext<SolicitudCarritoValue | null>(null)

// Vive en app/solicitud/[token]/layout.tsx — un layout de Next.js no se
// desmonta al navegar entre rutas hijas (el listado /solicitud/[token] y el
// detalle /solicitud/[token]/producto/[id]), así que el carrito sobrevive la
// navegación sin tocar localStorage ni el backend (la solicitud solo se
// persiste de verdad al enviarla).
export function SolicitudCarritoProvider({ children }: { children: React.ReactNode }) {
  const [carrito, setCarrito] = useState<LineaCarrito[]>([])

  const fijarCantidad = useCallback((producto: ProductoParaCarrito, cantidad: number) => {
    setCarrito(prev => fijarCantidadProducto(prev, producto, cantidad))
  }, [])

  const cantidadDe = useCallback((productoId: string) => cantidadEnCarrito(carrito, productoId), [carrito])

  return (
    <SolicitudCarritoContext.Provider value={{ carrito, setCarrito, fijarCantidad, cantidadDe }}>
      {children}
    </SolicitudCarritoContext.Provider>
  )
}

export function useSolicitudCarrito() {
  const ctx = useContext(SolicitudCarritoContext)
  if (!ctx) throw new Error('useSolicitudCarrito debe usarse dentro de SolicitudCarritoProvider')
  return ctx
}
