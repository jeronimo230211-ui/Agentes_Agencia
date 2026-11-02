'use client'

import { useRef } from 'react'
import { Search, X } from 'lucide-react'

interface SearchFieldProps {
  value: string
  onChange: (valor: string) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
}

// Buscador de texto reutilizable para las 5 pantallas de filtros (Proformas,
// Despachos, Finanzas, Solicitudes, Facturador) -- mismo patrón visual que
// ya usa /catalogo, llevado a h-11 (44px, mínimo táctil del sistema de
// diseño) y con botón de limpiar.
//
// Sin debounce a propósito: estas pantallas filtran sobre datos que YA
// están en memoria (no hay llamada a red por cada tecla). Si tu pantalla sí
// pega contra una API en cada búsqueda, el debounce va afuera, en el
// onChange que le pasas (ver app/(app)/catalogo/page.tsx, que sí debouncea
// porque pagina en el servidor).
export default function SearchField({ value, onChange, placeholder, autoFocus, className }: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function limpiar() {
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full h-11 pl-9 pr-9 text-sm border border-border rounded-lg bg-bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
      />
      {value !== '' && (
        <button
          type="button"
          onClick={limpiar}
          aria-label="Limpiar búsqueda"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text-muted p-1"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
