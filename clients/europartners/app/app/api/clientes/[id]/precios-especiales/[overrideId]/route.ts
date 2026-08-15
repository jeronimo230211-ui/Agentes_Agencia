import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

type Params = { params: { id: string; overrideId: string } }

// Quita un precio especial (vuelve al precio de catálogo normal) — no se
// borra la fila, se desactiva, para conservar el historial de quién fijó
// qué precio y cuándo (mismo criterio que historial_precios).
export async function PATCH(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('precios_especiales_cliente')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', params.overrideId)
    .eq('cliente_id', params.id)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No se encontró ese precio especial' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
