import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { calcMargen } from '@/lib/precio'

type Params = { params: { id: string } }

// Corrige el "Costo China" (precio_costo_usd) de una fila YA EXISTENTE de
// historial_precios -- muchas filas quedaron con este dato en null porque no
// se cargó en su momento, y Deisy/Marta necesitan poder completarlo o
// corregirlo directamente desde /historial. Distinto del POST de ../route.ts:
// ese crea una fila NUEVA sin proforma asociada (precio de referencia cargado
// a mano) -- este PATCH nunca crea filas, solo corrige una existente.
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body || !('precio_costo_usd' in body)) {
    return NextResponse.json({ error: 'Falta precio_costo_usd' }, { status: 400 })
  }

  // null borra el costo (vuelve a quedar sin dato, se muestra "—"); cualquier
  // otro valor debe ser un número positivo -- 0 o negativo no es un costo real.
  let precioCostoUsd: number | null = null
  if (body.precio_costo_usd !== null) {
    const n = Number(body.precio_costo_usd)
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: 'El costo debe ser un número positivo' }, { status: 400 })
    }
    precioCostoUsd = n
  }

  // historial_precios solo tiene policy de lectura para authenticated (RLS) --
  // escribir requiere service_role, igual que el POST de ../route.ts.
  const adminClient = createAdminClient()

  const { data: fila, error: filaError } = await adminClient
    .from('historial_precios')
    .select('id, precio_cliente_usd')
    .eq('id', params.id)
    .maybeSingle()

  if (filaError) return NextResponse.json({ error: filaError.message }, { status: 500 })
  if (!fila) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })

  // Misma fórmula que el resto de la app (lib/precio.ts), pero calcMargen()
  // devuelve 0 cuando el costo es 0/null -- acá sí necesitamos null explícito,
  // porque "margen 0%" y "no se puede calcular" se ven distinto en la tabla.
  const margenPct = precioCostoUsd != null && fila.precio_cliente_usd != null
    ? calcMargen(precioCostoUsd, fila.precio_cliente_usd)
    : null

  const { data, error } = await adminClient
    .from('historial_precios')
    .update({ precio_costo_usd: precioCostoUsd, margen_pct: margenPct })
    .eq('id', params.id)
    .select('id, precio_costo_usd, margen_pct')
    .single()

  if (error) {
    console.error('[PATCH /api/historial/:id] update falló', { id: params.id, error })
    return NextResponse.json({ error: `No se pudo guardar: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ data })
}
