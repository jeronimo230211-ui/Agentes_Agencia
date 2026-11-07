'use client'

import { useId, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown } from 'lucide-react'

type Variante = 'card' | 'tile' | 'link'

interface SeccionColapsableProps {
  /** Label/título siempre visible, dentro del botón que abre/cierra. */
  titulo: ReactNode
  /** Variante "link": texto a mostrar cuando está abierto (ej. "Ocultar detalle"). Si se omite, reusa `titulo`. */
  tituloAbierto?: ReactNode
  /** Variante "tile": valor grande debajo del título (headline del KPI). */
  headline?: ReactNode
  /** Ícono a la izquierda del título (variantes "card" y "tile"). */
  icon?: LucideIcon
  /**
   * Elemento NO interactivo a la derecha del título, antes del chevron (ej.
   * SemaforoDot, un conteo). Nunca debe ser un <a>/<button>: vive dentro del
   * <button> que abre/cierra la sección, y anidar un control interactivo ahí
   * es HTML inválido. Cualquier link o control adicional (ej. "Ver todas",
   * el segmentado Operativo/Estratégico) va en `children`, visible solo
   * cuando la sección está abierta.
   */
  indicador?: ReactNode
  defaultAbierto?: boolean
  variante?: Variante
  children: ReactNode
  className?: string
}

// Botón+chevron+aria-expanded reutilizado en todo el dashboard: antes
// "TileEstrategico" y el "Ver detalle" de ConcentracionCard tenían cada uno
// su propia copia casi idéntica de este patrón, y las 3 secciones de primer
// nivel (Mis Pendientes / Proformas recientes / KPIs) necesitaban lo mismo.
// Cada instancia maneja su propio estado abierto/cerrado -- nunca exclusivo
// entre secciones (abrir una no cierra las demás).
export default function SeccionColapsable({
  titulo,
  tituloAbierto,
  headline,
  icon: Icon,
  indicador,
  defaultAbierto = false,
  variante = 'card',
  children,
  className,
}: SeccionColapsableProps) {
  const [abierto, setAbierto] = useState(defaultAbierto)
  const bodyId = useId()

  const chevron = (
    <ChevronDown
      size={variante === 'link' ? 14 : 18}
      className={`text-text-subtle transition-transform flex-shrink-0 ${abierto ? 'rotate-180' : ''}`}
    />
  )

  if (variante === 'link') {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setAbierto(a => !a)}
          aria-expanded={abierto}
          aria-controls={bodyId}
          className="text-action-primary text-sm font-medium hover:underline flex items-center gap-1 min-h-[44px]"
        >
          {abierto ? (tituloAbierto ?? titulo) : titulo}
          {chevron}
        </button>
        {abierto && (
          <div id={bodyId} className="mt-3 pt-3 border-t border-border">
            {children}
          </div>
        )}
      </div>
    )
  }

  if (variante === 'tile') {
    return (
      <div className={`bg-bg-surface rounded-xl shadow-sm border border-border overflow-hidden ${className ?? ''}`}>
        <button
          type="button"
          onClick={() => setAbierto(a => !a)}
          aria-expanded={abierto}
          aria-controls={bodyId}
          className="w-full flex items-center gap-3 p-4 text-left min-h-[44px]"
        >
          {Icon && (
            <span className="inline-flex p-2 rounded-lg bg-bg-subtle text-text-muted flex-shrink-0">
              <Icon size={18} />
            </span>
          )}
          <span className="flex-1 min-w-0">
            <span className="block text-text-body-sm text-text-muted">{titulo}</span>
            <span className="block text-heading-2 text-text-heading truncate">{headline}</span>
          </span>
          {indicador}
          {chevron}
        </button>
        {abierto && (
          <div id={bodyId} className="border-t border-border p-4 pt-3">
            {children}
          </div>
        )}
      </div>
    )
  }

  // variante "card" (default): secciones de primer nivel del dashboard
  // (Mis Pendientes, Proformas recientes, KPIs).
  return (
    <div className={`bg-bg-surface rounded-xl shadow-sm border border-border overflow-hidden ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
        aria-controls={bodyId}
        className="w-full flex items-center justify-between gap-3 p-4 text-left min-h-[44px]"
      >
        <span className="font-bold text-text flex items-center gap-2 min-w-0">
          {Icon && <Icon size={18} className="text-text-heading flex-shrink-0" />}
          <span className="truncate">{titulo}</span>
        </span>
        <span className="flex items-center gap-2 flex-shrink-0">
          {indicador}
          {chevron}
        </span>
      </button>
      {abierto && (
        <div id={bodyId} className="border-t border-border p-4 pt-3">
          {children}
        </div>
      )}
    </div>
  )
}
