'use client'
import Link from 'next/link'
import { Package } from 'lucide-react'
import { formatUSD } from '@/lib/precio'

export interface ProductoRelacionado {
  id: string
  codigo: string
  nombre: string
  imagen_url?: string | null
  // Interno muestra precio_mayorista, público precio_cliente — cualquiera
  // de los dos que venga se formatea igual.
  precio?: number | null
}

interface Props {
  productos: ProductoRelacionado[]
  hrefBuilder: (id: string) => string
  titulo?: string
}

// "También te puede interesar" — se oculta la sección entera si hay menos
// de 2 relacionados (spec ui-ux-designer).
export default function ProductosRelacionados({ productos, hrefBuilder, titulo = 'También te puede interesar' }: Props) {
  if (productos.length < 2) return null

  return (
    <div className="mt-2">
      <h2 className="text-sm font-bold uppercase tracking-wide mb-3 text-text-muted">
        {titulo}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {productos.slice(0, 8).map(p => (
          <Link
            key={p.id}
            href={hrefBuilder(p.id)}
            // BUG-007: era bg-white fijo -- el código (text-text-heading, token)
            // se vuelve blanco en modo oscuro y quedaba blanco sobre blanco.
            className="bg-bg-surface rounded-xl overflow-hidden flex flex-col border border-border hover:border-ultramar hover:shadow-md transition-all"
          >
            <div className="h-28 flex items-center justify-center bg-bg-subtle">
              {p.imagen_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-contain p-2" />
              ) : (
                <Package size={24} className="text-text-subtle" />
              )}
            </div>
            <div className="p-2.5">
              <p className="text-text-code text-text-heading">{p.codigo}</p>
              <p className="text-xs text-text font-medium leading-tight line-clamp-2 mt-0.5">{p.nombre}</p>
              {p.precio != null && (
                <p className="text-xs font-bold tabular-nums mt-1 text-text-heading">{formatUSD(p.precio)}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
