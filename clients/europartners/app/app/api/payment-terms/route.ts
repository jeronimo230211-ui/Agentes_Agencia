import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

// Opciones del selector "Payment Terms" del cotizador — migración
// 025_payment_terms.sql. Sin pantalla de administración aparte: el modal
// "+ agregar" en cotizador/[id]/page.tsx es toda la gestión pedida.
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('payment_terms_opciones')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado para agregar opciones de Payment Terms' }, { status: 403 })
  }

  const body = await req.json()
  const valor = typeof body.valor === 'string' ? body.valor.trim() : ''
  if (!valor) return NextResponse.json({ error: 'El valor es obligatorio' }, { status: 400 })

  // RLS de payment_terms_opciones solo admite insert desde service_role
  // (mismo patrón que clientes/proformas — ver migración 025), el chequeo
  // de rol de arriba ya es la barrera real.
  const adminClient = createAdminClient()

  const { data: ultimo } = await adminClient
    .from('payment_terms_opciones')
    .select('orden')
    .order('orden', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  const siguienteOrden = (ultimo?.orden ?? 0) + 1

  const { data, error } = await adminClient
    .from('payment_terms_opciones')
    .insert({ valor, activo: true, orden: siguienteOrden })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
