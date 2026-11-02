'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Sincroniza un grupo de filtros de una pantalla con los query params de la
 * URL, para poder compartir un link ya filtrado (ej. "proformas pendientes
 * del cliente X"). Lee el valor inicial de cada filtro desde la URL al
 * montar, y reescribe la URL (shallow, con router.replace -- sin recargar
 * la página ni perder el scroll) cada vez que un filtro cambia.
 *
 * Omite de la URL cualquier filtro cuyo valor sea igual a su default (texto
 * vacío '' en la mayoría de los casos), para no ensuciarla con
 * `?estado=&anio=&q=`. Funciona para varios filtros a la vez en la misma
 * pantalla (ej. `?q=0126&estado=enviada&anio=2026`).
 *
 * IMPORTANTE (Next 14): useSearchParams() exige un boundary <Suspense> en
 * client components. Toda página que use este hook DEBE envolver su
 * contenido en <Suspense>, igual que ya hace /proformas: un componente
 * wrapper exportado por default con <Suspense fallback={...}>, y un
 * componente *Content separado (ej. ProformasContent) con la lógica real
 * y el useFiltrosUrl adentro. Sin este boundary, `next build` falla.
 *
 * @param defaults    Valor por defecto de cada filtro -- también define sus
 *                     keys y tipos. Puede ser un objeto literal nuevo en
 *                     cada render: su identidad no entra en el cálculo de
 *                     cuándo reescribir la URL, solo su contenido.
 * @param validadores  Opcional, por key: función que decide si el valor
 *                     leído de la URL al montar es válido para ese filtro
 *                     (ej. que el estado exista en tu catálogo de estados
 *                     de negocio). Si no es válido, se usa el default en
 *                     vez de confiar en un query param escrito a mano o
 *                     que quedó viejo -- mismo chequeo que ya hacía
 *                     /proformas a mano para `estado` (BUG-001).
 *
 * Uso:
 *   const { filtros, setFiltro } = useFiltrosUrl({ q: '', estado: '', anio: '' })
 *   <SearchField value={filtros.q} onChange={v => setFiltro('q', v)} />
 */
export function useFiltrosUrl<T extends Record<string, string>>(
  defaults: T,
  validadores?: Partial<{ [K in keyof T]: (valor: string) => boolean }>
) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [filtros, setFiltros] = useState<T>(() => {
    const inicial = { ...defaults }
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const valor = searchParams.get(key as string)
      if (valor === null) continue
      const esValido = validadores?.[key] ? validadores[key]!(valor) : true
      if (esValido) inicial[key] = valor as T[typeof key]
    }
    return inicial
  })

  // Reescribe la URL cada vez que cambia algún filtro. `defaults` queda
  // fuera del array de dependencias a propósito: si el caller lo pasa como
  // objeto literal (el uso normal), cambia de identidad en cada render y
  // entraría en loop si lo incluyéramos -- aquí solo nos importa su
  // *contenido* para decidir qué key omitir, no su identidad.
  useEffect(() => {
    const params = new URLSearchParams()
    for (const key of Object.keys(filtros) as (keyof T)[]) {
      const valor = filtros[key]
      // BUG-011: antes era `valor && valor !== defaults[key]` -- como ''
      // es falsy en JS, cuando el default de un filtro NO es '' (ej.
      // Solicitudes: estado default 'pendiente'), elegir explícitamente
      // "Todas" (valor '') nunca se escribía en la URL y al recargar
      // volvía a caer en el default. Comparar solo contra el default
      // respeta cualquier valor explícito, incluido ''.
      if (valor !== defaults[key]) params.set(key as string, valor)
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros, pathname, router])

  function setFiltro<K extends keyof T>(key: K, valor: T[K]) {
    setFiltros(prev => ({ ...prev, [key]: valor }))
  }

  function limpiarFiltros() {
    setFiltros({ ...defaults })
  }

  return { filtros, setFiltro, setFiltros, limpiarFiltros } as const
}
