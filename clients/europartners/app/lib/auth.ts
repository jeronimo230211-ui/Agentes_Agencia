import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Usuario } from '@/types/europartners'

/**
 * Helper para rutas API: sesión + fila de `usuarios` en una sola llamada.
 * Devuelve null si no hay sesión o si el usuario no tiene fila en `usuarios`.
 * Centraliza el patrón que se repetía inline en aprobar/rechazar/etc.
 */
export async function getCurrentUsuario() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!usuario) return null

  return { supabase, session, usuario: usuario as Usuario }
}
