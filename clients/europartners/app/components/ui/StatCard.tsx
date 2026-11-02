'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'

interface StatCardProps {
  label: string
  value: ReactNode
  // LucideIcon (no ComponentType<{size}> genérico): los iconos de
  // lucide-react traen más props (ref, strokeWidth, className...) y un
  // tipo demasiado angosto rompe tsc en cada módulo que pasa un ícono.
  icon: LucideIcon
  /** Clases ya tokenizadas del fondo+texto del ícono, ej. "bg-success-bg text-success". */
  iconClassName: string
  href?: string
  loading?: boolean
}

// Tile de KPI reutilizable (dashboard, finanzas, reportes...). Tamaño
// heading-2 (22px) para el valor, NO figure-lg (36px): el sistema de diseño
// de Marta recomienda esto para tiles de dashboard porque 4 en fila a 36px
// queda demasiado apretado (figure-lg sí es correcto para un precio solo en
// una tabla). Ver docs/design-system/README.md.
export default function StatCard({ label, value, icon: Icon, iconClassName, href, loading }: StatCardProps) {
  const content = (
    <div className="bg-bg-surface rounded-xl p-5 shadow-sm border border-border hover:shadow-md transition-shadow h-full">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${iconClassName}`}>
        <Icon size={20} />
      </div>
      <p className="text-heading-2 text-text-heading">{loading ? '—' : value}</p>
      <p className="text-text-body-sm text-text-muted mt-1">{label}</p>
    </div>
  )

  if (!href) return content

  return (
    <Link href={href} className="cursor-pointer block">
      {content}
    </Link>
  )
}
