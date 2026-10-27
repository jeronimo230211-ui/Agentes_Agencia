'use client'
import { Palette, Ruler, Boxes, Package, Info } from 'lucide-react'
import {
  seleccionarEspecificaciones,
  type ParametrosEspecificaciones,
  type EspecificacionSeleccionada,
} from '@/lib/especificacionesPrincipales'

interface Chip { icon: typeof Ruler; texto: string }

const ICONOS: Record<EspecificacionSeleccionada['clave'], typeof Ruler> = {
  color: Palette, dimensiones: Ruler, moq: Boxes, cbm: Package, ficha: Info,
}

// El texto de un campo libre de ficha_tecnica puede ser una frase larga
// (ej. una nota de fuente entre paréntesis) — se recorta siempre a un
// tamaño de chip razonable. El título completo queda en el `title` del
// elemento para quien lo necesite.
const MAX_CHIP = 36
const recortar = (s: string) => (s.length > MAX_CHIP ? s.slice(0, MAX_CHIP - 1).trimEnd() + '…' : s)

// Fila de hasta 4 chips con los datos más relevantes DE ESE producto. La
// selección de qué campos mostrar (y en qué orden) vive en
// lib/especificacionesPrincipales.ts, compartida con EspecificacionesPrincipales
// (caja de viñetas) para que ambas no se desincronicen. Oculta la fila
// completa si no hay nada que mostrar (spec ui-ux-designer).
export default function DestacadosRapidos(props: ParametrosEspecificaciones) {
  const seleccion = seleccionarEspecificaciones(props, 4)

  const chips: Chip[] = seleccion.map(({ clave, label, valor }) => ({
    icon: ICONOS[clave],
    texto:
      clave === 'moq' ? `MOQ ${valor}` :
      clave === 'ficha' ? recortar(`${label}: ${valor}`) :
      valor,
  }))

  if (chips.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 min-w-0">
      {chips.map(({ icon: Icon, texto }, i) => (
        <div
          key={i}
          title={texto}
          className="flex items-center gap-1.5 flex-shrink-0 rounded-full py-[7px] px-3.5 text-[13px] font-semibold whitespace-nowrap border max-w-[260px]"
          style={{ background: '#F8FAFC', color: 'var(--ep-navy)', borderColor: 'var(--ep-border)' }}
        >
          <Icon size={13} style={{ color: 'var(--ep-navy)' }} className="flex-shrink-0" />
          <span className="truncate">{texto}</span>
        </div>
      ))}
    </div>
  )
}
