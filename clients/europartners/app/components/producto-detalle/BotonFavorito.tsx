'use client'
import { useState, useEffect } from 'react'
import { Bookmark } from 'lucide-react'
import { esFavorito, alternarFavorito } from '@/lib/favoritos'

interface Props {
  productoId: string
  className?: string
  // La vista pública está en inglés y la interna en español -- en vez de
  // hardcodear el idioma acá, quien use el botón pasa su propio texto.
  textoGuardar?: string
  textoGuardado?: string
}

// Botón "Guardar en mis listas" -- alcance confirmado por Jerónimo
// (26-oct-2026): favoritos simples, solo visual, localStorage, nada de
// backend todavía. Útil en la vista interna para que Deisy/Jerónimo marquen
// productos a revisar, y en la pública para que el cliente marque lo que le
// interesa.
export default function BotonFavorito({ productoId, className = '', textoGuardar = 'Guardar', textoGuardado = 'Guardado' }: Props) {
  const [guardado, setGuardado] = useState(false)

  // localStorage no existe en el render de servidor -- arrancar en false y
  // leer el valor real recién en el cliente evita un hydration mismatch.
  useEffect(() => {
    setGuardado(esFavorito(productoId))
  }, [productoId])

  function manejarClick() {
    setGuardado(alternarFavorito(productoId))
  }

  return (
    <button
      type="button"
      onClick={manejarClick}
      aria-pressed={guardado}
      aria-label={guardado ? textoGuardado : textoGuardar}
      className={`flex items-center justify-center gap-1.5 rounded-lg border text-sm font-semibold transition-colors flex-shrink-0 ${
        guardado
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
      } ${className}`}
      style={{ minHeight: 44, minWidth: 44 }}
    >
      <Bookmark size={16} fill={guardado ? 'currentColor' : 'none'} />
      <span className="hidden sm:inline">{guardado ? textoGuardado : textoGuardar}</span>
    </button>
  )
}
