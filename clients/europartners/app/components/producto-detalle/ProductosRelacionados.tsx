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
      <h2 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--ep-muted)' }}>
        {titulo}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {productos.slice(0, 8).map(p => (
          <Link
            key={p.id}
            href={hrefBuilder(p.id)}
            className="bg-white rounded-xl overflow-hidden flex flex-col border-[var(--ep-border)] border hover:border-[var(--ep-navy)] hover:shadow-md transition-all"
          >
            <div className="h-28 flex items-center justify-center" style={{ background: '#F8FAFC' }}>
              {p.imagen_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-contain p-2" />
              ) : (
                <Package size={24} className="text-gray-300" />
              )}
            </div>
            <div className="p-2.5">
              <p className="font-mono text-[11px] font-bold" style={{ color: 'var(--ep-navy)' }}>{p.codigo}</p>
              <p className="text-xs text-gray-700 font-medium leading-tight line-clamp-2 mt-0.5">{p.nombre}</p>
              {p.precio != null && (
                <p className="text-xs font-bold mt-1" style={{ color: 'var(--ep-navy)' }}>{formatUSD(p.precio)}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
