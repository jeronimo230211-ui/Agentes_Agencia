'use client'

import Link from 'next/link'

export interface RankedBarListItem {
  id: string
  label: string
  value: number
  /** Texto ya formateado a la derecha de la barra (ej. "12.3% · $4,500"). */
  valueLabel: string
  /**
   * Banda de referencia estilo bullet-chart (tramo claro detrás de la barra
   * oscura) -- ej. el rango margen_min/margen_max de un cliente. Si se
   * omite (o falta uno de los dos), la fila es una barra de un solo color
   * sin banda.
   */
  bandMin?: number | null
  bandMax?: number | null
  href?: string
}

interface RankedBarListProps {
  items: RankedBarListItem[]
  /**
   * Escala del eje (0 a `max`). Si se omite, se calcula del mayor
   * valor/banda de la lista. Usar un `max` fijo (ej. 100) cuando los
   * valores ya son un % del total y hay que compararlos contra el 100%
   * completo, no solo entre ellos.
   */
  max?: number
}

// Ranking en barras horizontales de un solo color (var(--action-primary))
// que reemplaza los rankings de solo texto del dashboard -- reusado en
// concentración de clientes/países, rentabilidad por cliente (con banda),
// margen por categoría, deuda viva y pérdidas/notas de crédito.
export default function RankedBarList({ items, max }: RankedBarListProps) {
  if (items.length === 0) return null
  const escala = max ?? Math.max(1, ...items.map(i => Math.max(i.value, i.bandMax ?? 0)))

  return (
    <div className="space-y-2.5">
      {items.map(item => {
        const pctValor = Math.min(100, Math.max(0, (item.value / escala) * 100))
        const tieneBanda = item.bandMin != null && item.bandMax != null
        const pctMin = tieneBanda ? Math.min(100, Math.max(0, ((item.bandMin as number) / escala) * 100)) : 0
        const pctMax = tieneBanda ? Math.min(100, Math.max(0, ((item.bandMax as number) / escala) * 100)) : 0

        return (
          <div key={item.id}>
            <div className="flex items-center justify-between gap-2 mb-1 text-sm">
              {item.href ? (
                <Link href={item.href} className="font-mono text-action-primary hover:underline truncate min-w-0">
                  {item.label}
                </Link>
              ) : (
                <span className="text-text-muted truncate min-w-0">{item.label}</span>
              )}
              <span className="font-medium text-text whitespace-nowrap flex-shrink-0">{item.valueLabel}</span>
            </div>
            <div className="relative h-2 rounded-full bg-bg-subtle overflow-hidden">
              {tieneBanda && (
                <div
                  className="absolute inset-y-0 bg-action-primary/20 rounded-full"
                  style={{ left: `${pctMin}%`, width: `${Math.max(0, pctMax - pctMin)}%` }}
                />
              )}
              <div className="absolute inset-y-0 left-0 bg-action-primary rounded-full" style={{ width: `${pctValor}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
