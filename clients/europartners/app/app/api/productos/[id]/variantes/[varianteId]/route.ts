import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-server'

type Params = { params: { id: string; varianteId: string } }

async function autorizar(supabase: ReturnType<typeof createRouteHandlerClient>) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return { error: NextResponse.json({ error: 'No autorizado para editar productos' }, { status: 403 }) }
  }
  return { error: null }
}

// Edición de nombre/precio de referencia de una variante ya cargada.
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { error: authError } = await autorizar(supabase)
  if (authError) return authError

  const body = await req.json().catch(() => ({}))
  const update: Record<string, unknown> = {}

  if (body.variante !== undefined) {
    const variante = String(body.variante || '').trim()
    if (!variante) return NextResponse.json({ error: 'El nombre de la variante es obligatorio' }, { status: 400 })
    update.variante = variante
  }
  if (body.precio_fob_usd !== undefined) {
    const precio_fob_usd = body.precio_fob_usd === '' || body.precio_fob_usd == null ? null : Number(body.precio_fob_usd)
    if (precio_fob_usd !== null && !Number.isFinite(precio_fob_usd)) {
      return NextResponse.json({ error: 'El precio de referencia no es un número válido' }, { status: 400 })
    }
    if (precio_fob_usd !== null && precio_fob_usd < 0) {
      return NextResponse.json({ error: 'El precio de referencia no puede ser negativo' }, { status: 400 })
    }
    update.precio_fob_usd = precio_fob_usd
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('producto_variantes')
    .update(update)
    .eq('id', params.varianteId)
    .eq('producto_id', params.id)
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `Ya existe una variante llamada "${update.variante}" en este producto` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// Elimina la variante. Sus componentes se borran en cascada -- migración 031
// declara `variante_id ... on delete cascade` en producto_componentes, así
// que no hace falta borrarlos a mano acá.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { error: authError } = await autorizar(supabase)
  if (authError) return authError

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('producto_variantes')
    .delete()
    .eq('id', params.varianteId)
    .eq('producto_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
