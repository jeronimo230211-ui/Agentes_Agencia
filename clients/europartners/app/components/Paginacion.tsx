'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  pagina: number
  totalPaginas: number
  onCambiar: (pagina: number) => void
  textoAnterior?: string
  textoSiguiente?: string
  // Recibe página actual + total para armar el texto central -- así el
  // catálogo interno (español) y el listado público de SolicitudForm (todo
  // en inglés, decisión existente de Jero) comparten este mismo componente
  // sin tener que duplicarlo.
  textoPagina?: (pagina: number, total: number) => string
}

// Controles simples de paginación (Amazon/Homecenter, no scroll infinito) --
// usado por el catálogo interno (app/(app)/catalogo/page.tsx, paginado en el
// servidor) y por el listado público de pedido (components/SolicitudForm.tsx,
// paginado en el cliente sobre el resultado ya filtrado). Botones ≥44px
// (regla mobile-first de la agencia) y se oculta solo si no hace falta.
export default function Paginacion({
  pagina, totalPaginas, onCambiar,
  textoAnterior = 'Anterior', textoSiguiente = 'Siguiente',
  textoPagina = (p, t) => `Página ${p} de ${t}`,
}: Props) {
  if (totalPaginas <= 1) return null

  return (
    <div className="flex items-center justify-center gap-3 mt-8 mb-2">
      <button
        type="button"
        onClick={() => onCambiar(Math.max(1, pagina - 1))}
        disabled={pagina === 1}
        className="flex items-center gap-1 px-4 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
        style={{ minHeight: 44 }}
      >
        <ChevronLeft size={16} /> {textoAnterior}
      </button>
      <span className="text-sm text-gray-500 px-1 whitespace-nowrap">{textoPagina(pagina, totalPaginas)}</span>
      <button
        type="button"
        onClick={() => onCambiar(Math.min(totalPaginas, pagina + 1))}
        disabled={pagina === totalPaginas}
        className="flex items-center gap-1 px-4 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
        style={{ minHeight: 44 }}
      >
        {textoSiguiente} <ChevronRight size={16} />
      </button>
    </div>
  )
}
