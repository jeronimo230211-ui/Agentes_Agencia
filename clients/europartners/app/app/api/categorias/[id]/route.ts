import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-server'

type Params = { params: { id: string } }

// Apaga/enciende una categoría completa del catálogo público (ver migración
// 026) — los productos de una categoría oculta siguen existiendo tal cual,
// solo deja de listarse la categoría (y por lo tanto sus productos) en
// /solicitud/[token]. El panel interno (catalogo/page.tsx) sigue mostrando
// TODAS las categorías siempre, para poder reactivarlas.
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado para editar categorías' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (typeof body?.activo !== 'boolean') {
    return NextResponse.json({ error: 'activo debe ser true o false' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('categorias_producto')
    .update({ activo: body.activo })
    .eq('id', params.id)
    .select('id, nombre, orden, activo')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
