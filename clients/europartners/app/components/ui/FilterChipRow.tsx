'use client'

interface ChipOption<T extends string> {
  label: string
  value: T
}

interface FilterChipRowProps<T extends string> {
  label?: string
  options: ChipOption<T>[]
  value: T
  onChange: (valor: T) => void
  // Por chip, ej. (v) => cuenta de proformas con ese estado -- para
  // mostrar "Pagada (12)" estilo Facturador. Opcional: si no se pasa, el
  // chip muestra solo el label.
  getCount?: (valor: T) => number
}

// Encapsula el patrón de fila de chips YA aprobado y en producción en
// /proformas (Año/Mes/Estado) para que nunca se desborde en mobile: el
// contenedor raíz de esas pantallas usa overflow-hidden para fijar el
// layout de la tabla, así que una fila de chips sin su propia pista de
// scroll quedaba recortada en 375px (BUG-009) -- solo "Todos" era
// alcanzable con el dedo.
//
// Contenedor: overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible
// (el -mx-4/px-4 extiende el área de scroll hasta el borde de la pantalla
// sin mover el resto del layout). Fila: flex-nowrap en mobile (scroll
// horizontal) y sm:flex-wrap desde tablet/desktop (sin scroll, los chips
// que no caben bajan de línea en vez de desbordar el contenedor).
export default function FilterChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
  getCount,
}: FilterChipRowProps<T>) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
      {label && (
        <span className="text-xs font-semibold text-text-subtle uppercase flex-shrink-0">{label}</span>
      )}
      <div className="flex gap-1 flex-nowrap sm:flex-wrap flex-shrink-0">
        {options.map(({ label: optLabel, value: optValue }) => {
          const activo = value === optValue
          const count = getCount?.(optValue)
          return (
            <button
              key={optValue}
              type="button"
              onClick={() => onChange(optValue)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors flex-shrink-0 ${
                activo
                  ? 'bg-bg-accent text-text-on-accent border-bg-accent'
                  : 'bg-bg-surface text-text-muted border-border hover:border-border-control'
              }`}
            >
              {optLabel}{count !== undefined ? ` (${count})` : ''}
            </button>
          )
        })}
      </div>
    </div>
  )
}
