import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-server'

type Params = { params: { id: string } }

// Alta de una variante de color de un producto (migración 031) -- antes solo
// se podía cargar por script (data-pipeline-engineer). Deisy/Marta la crean
// desde /catalogo/[id]; el precio de referencia es opcional y NUNCA se
// calcula desde sus componentes (son independientes a propósito, ver
// migración 031).
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado para editar productos' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const variante = String(body.variante || '').trim()
  const precio_fob_usd = body.precio_fob_usd === '' || body.precio_fob_usd == null ? null : Number(body.precio_fob_usd)

  if (!variante) return NextResponse.json({ error: 'El nombre de la variante es obligatorio' }, { status: 400 })
  if (precio_fob_usd !== null && !Number.isFinite(precio_fob_usd)) {
    return NextResponse.json({ error: 'El precio de referencia no es un número válido' }, { status: 400 })
  }
  if (precio_fob_usd !== null && precio_fob_usd < 0) {
    return NextResponse.json({ error: 'El precio de referencia no puede ser negativo' }, { status: 400 })
  }

  // RLS de producto_variantes solo admite escritura con service_role (ver
  // schema_v2.sql) -- el chequeo de rol de arriba es la barrera real.
  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('producto_variantes')
    .insert({ producto_id: params.id, variante, precio_fob_usd })
    .select('*')
    .single()

  if (error) {
    // unique(producto_id, variante) de schema_v2.sql
    if (error.code === '23505') {
      return NextResponse.json({ error: `Ya existe una variante llamada "${variante}" en este producto` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
