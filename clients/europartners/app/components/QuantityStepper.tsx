'use client'
import { useState, useEffect } from 'react'
import { Minus, Plus } from 'lucide-react'

interface Props {
  value: number
  onChange: (nuevoValor: number) => void
  size?: 'sm' | 'md'
  min?: number
}

// Selector de cantidad compartido: "-" a la izquierda, "+" a la derecha, y un
// input de texto en el medio para escribir la cantidad a mano. El input usa
// un buffer local que solo se confirma en onBlur/Enter (evita estados
// intermedios inválidos mientras el usuario escribe).
export default function QuantityStepper({ value, onChange, size = 'sm', min = 0 }: Props) {
  const [texto, setTexto] = useState(String(value))

  useEffect(() => { setTexto(String(value)) }, [value])

  function commit() {
    const n = parseInt(texto, 10)
    if (isNaN(n) || n < min) {
      setTexto(String(value))
      return
    }
    if (n !== value) onChange(n)
  }

  const dims = size === 'md'
    ? { btn: 'w-9 h-9', input: 'w-14 text-base', icon: 16 }
    : { btn: 'w-7 h-7', input: 'w-10 text-sm', icon: 13 }

  return (
    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className={`${dims.btn} rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 active:bg-gray-300 transition-colors flex-shrink-0`}
        aria-label="Quitar uno"
      >
        <Minus size={dims.icon} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={texto}
        onChange={e => setTexto(e.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        onClick={e => e.stopPropagation()}
        className={`${dims.input} text-center font-semibold text-gray-800 border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20`}
        aria-label="Cantidad"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className={`${dims.btn} rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 active:bg-gray-300 transition-colors flex-shrink-0`}
        aria-label="Agregar uno"
      >
        <Plus size={dims.icon} />
      </button>
    </div>
  )
}
