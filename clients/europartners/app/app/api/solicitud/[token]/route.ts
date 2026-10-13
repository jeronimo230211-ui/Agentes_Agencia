import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getCatalogoPublico } from '@/lib/catalogoPublico'
import { enviarNotificacionSolicitudNueva } from '@/lib/email'

type Params = { params: { token: string } }

// Los tokens se generan con encode(gen_random_bytes(16|32),'hex') (migraciones
// 001/010) = hex puro. Se acepta un charset algo más amplio para no romper
// tokens viejos, pero sin , . ( ) : etc., para que el valor nunca pueda
// alterar un filtro de PostgREST.
const TOKEN_REGEX = /^[0-9a-zA-Z_-]{8,128}$/

type ClienteToken = { id: string; nombre: string; activo: boolean; contacto_email: string | null }

// Busca al dueño del token con dos consultas .eq() (nunca interpolando el
// token en un .or()) y devuelve cuál de los 2 links se usó.
async function buscarClientePorToken(
  adminClient: ReturnType<typeof createAdminClient>,
  token: string
): Promise<{ cliente: ClienteToken; tipoPrecio: 'mayorista' | 'detallista' } | null> {
  if (!TOKEN_REGEX.test(token)) return null
  for (const [columna, tipoPrecio] of [
    ['token_mayorista', 'mayorista'],
    ['token_detallista', 'detallista'],
  ] as const) {
    const { data } = await adminClient
      .from('clientes')
      .select('id, nombre, activo, contacto_email')
      .eq(columna, token)
      .maybeSingle()
    if (data) return { cliente: data as ClienteToken, tipoPrecio }
  }
  return null
}

// Ruta pública — a diferencia de las rutas autenticadas, esta no llama a
// cookies()/headers() (createAdminClient no depende de la sesión), así que
// Next.js no la detecta como dinámica automáticamente y cachea el fetch a
// Supabase por defecto (App Router, Next 14) — sirviendo el catálogo/precio
// de la PRIMERA visita a TODOS los clientes después, hasta el próximo
// build/redeploy. force-dynamic la saca de ese cacheo. Bug real encontrado
// el 2026-08-13 probando el override de precio especial: el precio no
// cambiaba entre requests pese a escribir un valor nuevo en la base.
export const dynamic = 'force-dynamic'

// Ruta pública — el cliente accede desde su link fijo de pedido, sin login.
// Nunca expone precio_fob_usd (costo de Emily) ni ningún dato de margen.
export async function GET(_req: NextRequest, { params }: Params) {
  const adminClient = createAdminClient()

  const encontrado = await buscarClientePorToken(adminClient, params.token)
  const cliente = encontrado?.cliente

  if (!encontrado || !cliente || !cliente.activo) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  }

  // El tipo de precio a mostrar lo decide CUÁL de los 2 links usó el cliente,
  // no clientes.tipo — así Marta puede compartir el link mayorista o el
  // detallista del mismo cliente según a quién se lo esté mandando.
  const tipoPrecio = encontrado.tipoPrecio
  const { categorias, productos } = await getCatalogoPublico(adminClient, tipoPrecio, cliente.id)

  return NextResponse.json({
    cliente: { id: cliente.id, nombre: cliente.nombre, contactoCompleto: !!cliente.contacto_email },
    categorias,
    productos,
  })
}

// El cliente completa (opcional) sus datos de contacto tras enviar un
// pedido — este correo es el que se usa después para mandarle la proforma,
// el invoice, etc. (enviarProformaCliente / enviarProformaParaAprobacion ya
// leen clientes.contacto_email). Solo puede tocar el cliente dueño del
// token, no cualquier cliente.
export async function PATCH(req: NextRequest, { params }: Params) {
  const adminClient = createAdminClient()

  const encontrado = await buscarClientePorToken(adminClient, params.token)
  const cliente = encontrado?.cliente

  if (!encontrado || !cliente || !cliente.activo) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  }

  const body = await req.json()
  const contacto_email = typeof body.contacto_email === 'string' ? body.contacto_email.trim() : ''
  if (!contacto_email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const update = {
    contacto_email,
    contacto_nombre: typeof body.contacto_nombre === 'string' ? body.contacto_nombre.trim() || null : null,
    contacto_telefono: typeof body.contacto_telefono === 'string' ? body.contacto_telefono.trim() || null : null,
    direccion: typeof body.direccion === 'string' ? body.direccion.trim() || null : null,
  }

  const { error } = await adminClient.from('clientes').update(update).eq('id', cliente.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest, { params }: Params) {
  const adminClient = createAdminClient()

  const encontrado = await buscarClientePorToken(adminClient, params.token)
  const cliente = encontrado?.cliente

  if (!encontrado || !cliente || !cliente.activo) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  }

  const body = await req.json()
  const lineas = Array.isArray(body.lineas) ? body.lineas : []
  const notasCliente = typeof body.notas_cliente === 'string' ? body.notas_cliente : null

  if (lineas.length === 0) {
    return NextResponse.json({ error: 'Add at least one product' }, { status: 400 })
  }

  for (const l of lineas) {
    if (!l.producto_id && !l.descripcion_libre?.trim()) {
      return NextResponse.json({ error: 'Each line needs a product or a description' }, { status: 400 })
    }
    if (!l.cantidad || Number(l.cantidad) <= 0) {
      return NextResponse.json({ error: 'Invalid quantity in one of the lines' }, { status: 400 })
    }
  }

  const { data: solicitud, error } = await adminClient
    .from('solicitudes')
    .insert({ cliente_id: cliente.id, notas_cliente: notasCliente, estado: 'pendiente' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const lineasInsert = lineas.map((l: { producto_id?: string; descripcion_libre?: string; cantidad: number; notas?: string }) => ({
    solicitud_id: solicitud.id,
    producto_id: l.producto_id || null,
    descripcion_libre: l.descripcion_libre || null,
    cantidad: Number(l.cantidad),
    notas: l.notas || null,
  }))

  await adminClient.from('solicitud_lineas').insert(lineasInsert)

  // Notificar a operaciones (Deisy) y admin (Marta) — in-app + email
  const { data: operativos } = await adminClient
    .from('usuarios')
    .select('id, email')
    .in('rol', ['operaciones', 'admin'])
    .eq('activo', true)

  if (operativos && operativos.length > 0) {
    await adminClient.from('notificaciones').insert(
      operativos.map(u => ({
        usuario_id: u.id,
        tipo: 'solicitud_nueva',
        mensaje: `Nueva solicitud de ${cliente.nombre} (${lineas.length} línea${lineas.length !== 1 ? 's' : ''})`,
      }))
    )

    for (const u of operativos) {
      if (!u.email) continue
      try {
        await enviarNotificacionSolicitudNueva(cliente.nombre, lineas.length, u.email)
      } catch (e) {
        console.error('Error enviando email de solicitud nueva:', e instanceof Error ? e.message : String(e))
        // No fallar el request si el email falla — la notificación in-app ya se guardó
      }
    }
  }

  return NextResponse.json({ ok: true, solicitud_id: solicitud.id }, { status: 201 })
}
