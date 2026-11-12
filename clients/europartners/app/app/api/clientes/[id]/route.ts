import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-server'

type Params = { params: { id: string } }

// Deisy/Marta llenan o corrigen los datos de contacto de un cliente — mismo
// campo que el cliente puede llenar solo desde /solicitud/[token]. Si el
// cliente ya lo diligenció, esto simplemente lo muestra pre-cargado (GET de
// clientes ya trae estas columnas via select('*')) y permite corregirlo.
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado para editar clientes' }, { status: 403 })
  }

  const body = await req.json()

  // Defensa en profundidad: 'nombre' no puede llegar vacío aunque el
  // frontend ya valide -- un PATCH directo (curl, bug de UI) no debe poder
  // dejar un cliente sin nombre de empresa.
  if ('nombre' in body && (typeof body.nombre !== 'string' || !body.nombre.trim())) {
    return NextResponse.json({ error: 'El nombre de la empresa es obligatorio' }, { status: 400 })
  }

  const update: Record<string, string | null> = {}
  for (const campo of [
    'nombre', 'contacto_nombre', 'contacto_email', 'contacto_telefono', 'direccion',
    'incoterm_default', 'freight_default', 'insurance_default',
  ] as const) {
    if (campo in body) {
      update[campo] = typeof body[campo] === 'string' ? body[campo].trim() || null : null
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
  }

  // Quién hizo el cambio, para el trigger de auditoría (migración 030).
  // Sin esto el trigger igual registra el evento pero con usuario_id null.
  update.actualizado_por = session.user.id

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('clientes')
    .update(update)
    .eq('id', params.id)
    .select('id, nombre, contacto_nombre, contacto_email, contacto_telefono, direccion, incoterm_default, freight_default, insurance_default')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
