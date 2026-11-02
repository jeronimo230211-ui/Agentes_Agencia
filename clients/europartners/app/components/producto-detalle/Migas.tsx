'use client'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  // Href de "Catálogo" (distinto para interno y público).
  catalogoHref: string
  categoriaNombre?: string | null
  nombreProducto: string
  // El panel interno es en español; el público, en inglés (el resto de
  // SolicitudForm ya lo es — clientes mayormente angloparlantes).
  textoCatalogo?: string
  textoVolver?: string
}

// Migas de pan + botón volver, igual para la página interna y la pública.
// En móvil se colapsa a "‹ Volver" + categoría corta (spec ui-ux-designer).
export default function Migas({
  catalogoHref, categoriaNombre, nombreProducto,
  textoCatalogo = 'Catálogo', textoVolver = 'Volver',
}: Props) {
  return (
    <div className="mb-4">
      {/* Desktop/tablet */}
      <nav className="hidden sm:flex items-center gap-1.5 text-sm text-text-subtle flex-wrap">
        <Link href={catalogoHref} className="hover:text-text-link font-medium">{textoCatalogo}</Link>
        {categoriaNombre && (
          <>
            <ChevronRight size={14} className="flex-shrink-0" />
            <span>{categoriaNombre}</span>
          </>
        )}
        <ChevronRight size={14} className="flex-shrink-0" />
        <span className="text-text font-medium truncate max-w-xs">{nombreProducto}</span>
      </nav>

      {/* Móvil */}
      <Link
        href={catalogoHref}
        className="sm:hidden inline-flex items-center gap-1 text-sm font-semibold text-text-link -ml-1 px-1 py-1"
      >
        <ChevronLeft size={18} />
        {textoVolver}{categoriaNombre ? ` · ${categoriaNombre}` : ''}
      </Link>
    </div>
  )
}
