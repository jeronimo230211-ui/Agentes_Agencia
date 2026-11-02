'use client'

import type { ReactNode } from 'react'

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

// Colapso de los ~8 colores de estado ad-hoc (verde/amarillo/rojo/azul/
// morado/ámbar/slate/sky/teal/esmeralda...) a los 4 tokens semánticos del
// sistema de diseño de Marta (oct-2026) + un "neutral" sin carga semántica
// para borrador/sin-estado -- decisión aprobada por Jerónimo (Lote 2,
// rebrand oct-2026). El mapeo de CADA estado de negocio a una de estas 5
// variantes vive en el módulo que lo usa (proformas, despachos, etc.); el
// color en sí vive aquí, una sola vez, para que cambiar la paleta no
// implique tocar 10 archivos.
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
  // "neutral" NO es uno de los 4 colores de estado del sistema (serían 5) --
  // es el badge gris para borrador/descartado/sin-deuda: tokens de
  // superficie y texto secundario normales, sin significado de estado.
  neutral: 'bg-bg-subtle text-text-muted',
}

interface BadgeProps {
  variant: BadgeVariant
  icon?: ReactNode
  children: ReactNode
  className?: string
}

export default function Badge({ variant, icon, children, className }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${VARIANT_CLASSES[variant]} ${className ?? ''}`}
    >
      {icon}
      {children}
    </span>
  )
}
