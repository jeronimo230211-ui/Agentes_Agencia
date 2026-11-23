import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-server'

type Params = { params: { id: string; varianteId: string } }

// Alta de un componente (parte) de una variante de color -- ej. "Tank" de
// HK0426 WHITE. El cotizador (cotizador/[id]/page.tsx, productoEsDivisible)
// detecta solo mirando si existe al menos un producto_componentes.variante_id
// no nulo: no hace falta tocar nada ahí, el ícono de "dividir en partes"
// aparece solo en cuanto se carga el primer componente de un producto.
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado para editar productos' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const componente = String(body.componente || '').trim()
  const precio_fob_usd = body.precio_fob_usd === '' || body.precio_fob_usd == null ? null : Number(body.precio_fob_usd)

  if (!componente) return NextResponse.json({ error: 'El nombre de la parte es obligatorio' }, { status: 400 })
  if (precio_fob_usd !== null && !Number.isFinite(precio_fob_usd)) {
    return NextResponse.json({ error: 'El costo FOB no es un número válido' }, { status: 400 })
  }
  if (precio_fob_usd !== null && precio_fob_usd < 0) {
    return NextResponse.json({ error: 'El costo FOB no puede ser negativo' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Siguiente orden dentro de esta variante -- mismo patrón que
  // /api/payment-terms (POST): max(orden) existente + 1, para que las partes
  // queden en el orden en que se cargaron (el cotizador ya respeta ese orden
  // al armar las líneas, ver componentesDeVariante en cotizador/[id]/page.tsx).
  const { data: ultimo } = await adminClient
    .from('producto_componentes')
    .select('orden')
    .eq('variante_id', params.varianteId)
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle()
  const siguienteOrden = (ultimo?.orden ?? -1) + 1

  const { data, error } = await adminClient
    .from('producto_componentes')
    .insert({
      producto_id: params.id,
      variante_id: params.varianteId,
      componente,
      precio_fob_usd,
      orden: siguienteOrden,
    })
    .select('*')
    .single()

  if (error) {
    // idx_componentes_unico_por_variante (migración 031): no se puede repetir
    // el mismo nombre de parte dentro de la misma variante.
    if (error.code === '23505') {
      return NextResponse.json({ error: `Ya existe una parte llamada "${componente}" en esta variante` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
