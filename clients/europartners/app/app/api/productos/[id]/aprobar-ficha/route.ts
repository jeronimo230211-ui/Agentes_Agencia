import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-server'

type Params = { params: { id: string } }

// Aprueba la ficha técnica/descripción generada por el pipeline de IA (ver
// migración 014) — hasta que esto se llama, el catálogo público del cliente
// nunca muestra el contenido generado, solo el interno lo ve como "Borrador".
export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado para aprobar fichas técnicas' }, { status: 403 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('productos')
    .update({
      ficha_tecnica_estado: 'aprobada',
      ficha_tecnica_revisada_por: session.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select('id, ficha_tecnica_estado')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
