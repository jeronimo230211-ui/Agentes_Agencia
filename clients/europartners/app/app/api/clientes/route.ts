import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('activo', true)
    .order('nombre')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

function slugify(nombre: string) {
  return nombre
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Crea un cliente nuevo con sus 2 links de catálogo (mayorista/detallista) ya
// listos — para que Marta/Deisy den de alta un prospecto/cliente sin
// necesitar a alguien que corra un script contra Supabase.
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado para crear clientes' }, { status: 403 })
  }

  const body = await req.json()
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
  const pais = typeof body.pais === 'string' && body.pais.trim() ? body.pais.trim() : 'Jamaica'
  const tipo = body.tipo === 'detallista' ? 'detallista' : 'mayorista'

  if (!nombre) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

  const baseSlug = slugify(nombre)
  if (!baseSlug) return NextResponse.json({ error: 'Nombre inválido para generar el link' }, { status: 400 })

  // La tabla RLS de clientes no admite insert desde el cliente de sesión
  // normal (mismo patrón que solicitudes/proformas) — se usa admin client
  // aquí, ya con el chequeo de rol de arriba como barrera real.
  const adminClient = createAdminClient()

  let slug = baseSlug
  for (let intento = 0; intento < 5; intento++) {
    const { data: existente } = await adminClient.from('clientes').select('id').eq('slug', slug).maybeSingle()
    if (!existente) break
    slug = `${baseSlug}-${intento + 2}`
  }

  const { data, error } = await adminClient
    .from('clientes')
    .insert({ nombre, slug, pais, tipo, activo: true })
    .select('id, nombre, slug, pais, tipo, token_mayorista, token_detallista')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
