'use client'

export type Nivel = 'ok' | 'warn' | 'bad'

// Mismos 3 colores de estado ya reservados en todo el proyecto (Badge,
// ESTADO_VARIANT) -- nunca se inventa un color nuevo para severidad.
const FILL_CLASSES: Record<Nivel, string> = {
  ok: 'bg-success',
  warn: 'bg-warning',
  bad: 'bg-danger',
}

interface MeterProps {
  /** Valor actual, en el mismo eje 0-100 que `marcas`. */
  valor: number
  /** Marcas de referencia (0-100) -- ej. los umbrales de alerta/atención del indicador. */
  marcas?: number[]
  nivel: Nivel
  /** Texto accesible: el color/posición visual no le sirve a un lector de pantalla. */
  label: string
}

// Barra de severidad de UN solo valor (0-100) con marcas en los umbrales de
// alerta/atención -- distinto de RankedBarList (varias filas, cada una con
// su propio valor). Pensada para métricas donde hay un único número que
// comparar contra umbrales, ej. "% proformas perdidas".
export default function Meter({ valor, marcas = [], nivel, label }: MeterProps) {
  const pct = Math.min(100, Math.max(0, valor))
  return (
    <div
      role="meter"
      aria-valuenow={Math.round(valor * 10) / 10}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="relative h-2.5 rounded-full bg-bg-subtle overflow-hidden"
    >
      <div className={`absolute inset-y-0 left-0 rounded-full transition-all ${FILL_CLASSES[nivel]}`} style={{ width: `${pct}%` }} />
      {marcas.map(m => (
        <div key={m} className="absolute inset-y-0 w-px bg-border-strong" style={{ left: `${Math.min(100, Math.max(0, m))}%` }} />
      ))}
    </div>
  )
}
