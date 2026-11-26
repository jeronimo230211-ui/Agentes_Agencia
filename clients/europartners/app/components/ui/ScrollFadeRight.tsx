'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

// ─── Indicador de scroll horizontal ────────────────────────────────────────
// BUG-003 (QA mobile 375px, nov-2026): la barra de botones del header y la
// tabla de "Líneas de la proforma" (cotizador/[id]) tenían overflow-x
// funcional, pero a 375px no hay ninguna pista de que se puede deslizar --
// en la práctica nadie lo descubre. Envuelve cualquier contenedor con scroll
// horizontal y muestra una sombra sutil en el borde derecho SOLO mientras
// falte contenido por ver; se oculta sola al llegar al final o si el
// contenido ya cabe completo (ej. en desktop). className va en el div que de
// verdad scrollea; wrapperClassName es para el div exterior (p.ej. recortar
// la sombra a la esquina redondeada de una tarjeta sin tocar el scroll).
//
// Extraído de cotizador/[id]/page.tsx (donde vivía como función local) a
// components/ui/ para reusarlo en el tile "Excepciones de facturación" del
// Dashboard (migración 033) sin duplicar la lógica -- mismo criterio que
// Badge/SeccionColapsable, componentes compartidos viven una sola vez acá.
export default function ScrollFadeRight({
  children,
  className = '',
  wrapperClassName = '',
}: {
  children: ReactNode
  className?: string
  wrapperClassName?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [hayMasContenido, setHayMasContenido] = useState(false)

  const revisar = useCallback(() => {
    const el = ref.current
    if (!el) return
    // 2px de margen para no parpadear por redondeos de subpíxel.
    setHayMasContenido(el.scrollWidth - el.clientWidth - el.scrollLeft > 2)
  }, [])

  useEffect(() => {
    revisar()
    window.addEventListener('resize', revisar)
    return () => window.removeEventListener('resize', revisar)
  }, [revisar, children])

  return (
    <div className={`relative ${wrapperClassName}`}>
      <div ref={ref} onScroll={revisar} className={className}>
        {children}
      </div>
      <div
        aria-hidden
        className={`pointer-events-none absolute right-0 top-0 bottom-0 w-6 ep-scroll-fade-right transition-opacity duration-150 ${hayMasContenido ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  )
}
