'use client'
import { seleccionarEspecificaciones, type ParametrosEspecificaciones } from '@/lib/especificacionesPrincipales'

interface Props extends ParametrosEspecificaciones {
  // La vista pública está en inglés y la interna en español -- igual que en
  // BotonFavorito, el texto lo decide quien usa el componente.
  titulo?: string
}

// Caja de viñetas con las specs clave del producto, pedida por Jerónimo
// viendo la referencia de Homecenter: ahí va debajo del stepper/CTA, no
// donde está DestacadosRapidos (chips horizontales, otra posición de la
// página). Reusa la misma selección de campos — ver
// lib/especificacionesPrincipales.ts — para no mantener el orden de
// prioridad duplicado en dos componentes.
export default function EspecificacionesPrincipales({ titulo = 'Especificaciones principales', ...props }: Props) {
  const items = seleccionarEspecificaciones(props, 5)

  if (items.length === 0) return null

  return (
    // BUG-007: contenedor bg-bg-subtle (token) + texto gray-700/800 (fijo) --
    // en modo oscuro bg-subtle se vuelve oscuro y ese texto casi invisible.
    <div className="rounded-xl p-4 border bg-bg-subtle border-border">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">{titulo}</p>
      <ul className="space-y-1.5">
        {items.map(({ label, valor }, i) => (
          <li key={i} className="flex gap-2 text-sm text-text">
            <span className="mt-[7px] h-1 w-1 rounded-full flex-shrink-0 bg-text-heading" />
            <span>
              <span className="font-semibold text-text-heading">{label}:</span> {valor}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
