import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Siempre devuelve TODAS las categorías (activas e inactivas): este
  // endpoint solo lo consume el panel interno autenticado, que necesita ver
  // las apagadas para poder reactivarlas (ver migración 026). El catálogo
  // público filtra por su cuenta en getCatalogoPublico().
  const { data, error } = await supabase
    .from('categorias_producto')
    .select('id, nombre, orden, activo')
    .order('orden', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
