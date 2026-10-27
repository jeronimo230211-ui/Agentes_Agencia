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
    <div className="rounded-xl p-4 border" style={{ background: '#F8FAFC', borderColor: 'var(--ep-border)' }}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{titulo}</p>
      <ul className="space-y-1.5">
        {items.map(({ label, valor }, i) => (
          <li key={i} className="flex gap-2 text-sm text-gray-700">
            <span className="mt-[7px] h-1 w-1 rounded-full flex-shrink-0" style={{ background: 'var(--ep-navy)' }} />
            <span>
              <span className="font-semibold text-gray-800">{label}:</span> {valor}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
