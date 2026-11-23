'use client'

import { useEffect, useRef } from 'react'

// Ventana mínima entre recargas disparadas por este hook. Cambiar de
// pestaña dispara 'visibilitychange' Y 'focus' casi al mismo tiempo, y un
// usuario que alt-tabea varias veces rápido no necesita refetch en cada
// vuelta -- con los datos ya cargados hace unos segundos alcanza.
const MIN_MS_ENTRE_RECARGAS = 4000

/**
 * Vuelve a llamar `cargarFn` cuando la pestaña recupera foco/visibilidad
 * después de haber estado en segundo plano.
 *
 * Bug real: un usuario deja una pantalla de lista (ej. /proformas) abierta,
 * edita un registro desde otra pestaña/ventana (ej. el cotizador) y vuelve
 * a la pestaña de la lista ya abierta -- sin navegar con un link nuevo, así
 * que el useEffect de montaje no vuelve a correr. La lista se queda con el
 * total/estado viejo hasta que el usuario recarga a mano.
 *
 * Escucha tanto `visibilitychange` (cambiar de pestaña dentro del mismo
 * navegador) como `focus` de window (alt-tab a otra ventana/app) -- en
 * Chrome ambos eventos suelen disparar juntos al volver a una pestaña, el
 * debounce de abajo evita que eso dispare dos cargas.
 *
 * @param cargarFn función que recarga los datos de la pantalla (ya debe
 *                 traer sus propios filtros por closure, como
 *                 `cargarProformas` en /proformas). Se lee de un ref para
 *                 no tener que reinstalar los listeners cada vez que la
 *                 identidad de `cargarFn` cambia (ej. cuando cambian los
 *                 filtros que la componen).
 */
export function useRefrescarAlVolver(cargarFn: () => void) {
  const cargarFnRef = useRef(cargarFn)
  cargarFnRef.current = cargarFn

  const ultimaCargaRef = useRef(Date.now())

  useEffect(() => {
    function recargarSiToca() {
      const ahora = Date.now()
      if (ahora - ultimaCargaRef.current < MIN_MS_ENTRE_RECARGAS) return
      ultimaCargaRef.current = ahora
      cargarFnRef.current()
    }

    function alCambiarVisibilidad() {
      if (document.visibilityState === 'visible') recargarSiToca()
    }

    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    window.addEventListener('focus', recargarSiToca)
    return () => {
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      window.removeEventListener('focus', recargarSiToca)
    }
  }, [])
}
