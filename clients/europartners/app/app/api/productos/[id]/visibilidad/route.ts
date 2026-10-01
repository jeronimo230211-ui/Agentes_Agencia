import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-server'

type Params = { params: { id: string } }

const ESTADOS_PERMITIDOS = ['activo', 'oculto']

// Apaga/enciende un producto del catálogo (ver migración 026) sin pasar por
// el formulario completo de edición — un toggle rápido desde la ficha o la
// tarjeta del producto. Deliberadamente solo acepta 'activo'/'oculto': los
// valores 'pendiente'/'descontinuado' son decisiones de catálogo más finas
// que siguen viviendo únicamente en el formulario de edición completo.
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado para cambiar la visibilidad de productos' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const estado = body?.estado
  if (!ESTADOS_PERMITIDOS.includes(estado)) {
    return NextResponse.json({ error: `estado debe ser uno de: ${ESTADOS_PERMITIDOS.join(', ')}` }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('productos')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('id, estado')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
