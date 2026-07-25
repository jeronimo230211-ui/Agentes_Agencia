'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export const ROLES_EDICION = ['operaciones', 'admin']

// Rol del usuario logueado, para gatear en el cliente los mismos botones/campos
// que el servidor ya protege (defensa en profundidad, no reemplaza el chequeo de la API).
export function useRol() {
  const [rol, setRol] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    async function cargar() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
      if (activo && data) setRol(data.rol)
    }
    cargar()
    return () => { activo = false }
  }, [])

  return { rol, puedeEditar: !!rol && ROLES_EDICION.includes(rol) }
}
