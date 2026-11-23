import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-server'

type Params = { params: { id: string; componenteId: string } }

async function autorizar(supabase: ReturnType<typeof createRouteHandlerClient>) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return { error: NextResponse.json({ error: 'No autorizado para editar productos' }, { status: 403 }) }
  }
  return { error: null }
}

// Edición de nombre/costo de un componente ya cargado.
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { error: authError } = await autorizar(supabase)
  if (authError) return authError

  const body = await req.json().catch(() => ({}))
  const update: Record<string, unknown> = {}

  if (body.componente !== undefined) {
    const componente = String(body.componente || '').trim()
    if (!componente) return NextResponse.json({ error: 'El nombre de la parte es obligatorio' }, { status: 400 })
    update.componente = componente
  }
  if (body.precio_fob_usd !== undefined) {
    const precio_fob_usd = body.precio_fob_usd === '' || body.precio_fob_usd == null ? null : Number(body.precio_fob_usd)
    if (precio_fob_usd !== null && !Number.isFinite(precio_fob_usd)) {
      return NextResponse.json({ error: 'El costo FOB no es un número válido' }, { status: 400 })
    }
    if (precio_fob_usd !== null && precio_fob_usd < 0) {
      return NextResponse.json({ error: 'El costo FOB no puede ser negativo' }, { status: 400 })
    }
    update.precio_fob_usd = precio_fob_usd
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('producto_componentes')
    .update(update)
    .eq('id', params.componenteId)
    .eq('producto_id', params.id)
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `Ya existe una parte llamada "${update.componente}" en esta variante` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { error: authError } = await autorizar(supabase)
  if (authError) return authError

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('producto_componentes')
    .delete()
    .eq('id', params.componenteId)
    .eq('producto_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
