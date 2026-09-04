import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-server'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const categoria_id = searchParams.get('categoria_id')
  const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 1000)
  const offset = parseInt(searchParams.get('offset') || '0')

  let query = supabase
    .from('productos')
    .select(`
      id, codigo, nombre, descripcion, imagen_url, dimensiones,
      precio_fob_usd, precio_fob_fecha, estado, notas,
      precio_mayorista, precio_detallista, cbm_unitario, moq, color_variante,
      tiene_historial, veces_vendido, fecha_ultima_venta, precio_cliente_historico_ultimo,
      descripcion_larga_es, descripcion_larga_en, ficha_tecnica, ficha_tecnica_estado,
      categoria:categorias_producto(id, nombre),
      variantes:producto_variantes(*),
      componentes:producto_componentes(*)
    `)
    .eq('estado', 'activo')
    .order('categoria_id', { ascending: true })
    .order('codigo', { ascending: true })
    .range(offset, offset + limit - 1)

  if (q) {
    query = query.or(`codigo.ilike.%${q}%,nombre.ilike.%${q}%,descripcion.ilike.%${q}%`)
  }

  if (categoria_id) {
    query = query.eq('categoria_id', categoria_id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

function num(v: FormDataEntryValue | null): number | undefined {
  if (v === null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

// Alta manual de un producto de catálogo — antes la única vía era Supabase
// Table Editor directo (ver pendiente #26). Usa multipart/form-data para que
// la imagen viaje en el mismo request que los datos.
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado para crear productos' }, { status: 403 })
  }

  const formData = await req.formData()
  const codigo = String(formData.get('codigo') || '').trim()
  const nombre = String(formData.get('nombre') || '').trim()
  const descripcion = String(formData.get('descripcion') || '').trim() || null
  const categoria_id = String(formData.get('categoria_id') || '').trim() || null
  const notas = String(formData.get('notas') || '').trim() || null
  const precio_fob_usd = num(formData.get('precio_fob_usd'))
  const precio_mayorista = num(formData.get('precio_mayorista'))
  const precio_detallista = num(formData.get('precio_detallista'))
  const cbm_unitario = num(formData.get('cbm_unitario'))
  const moq = num(formData.get('moq'))
  const largo_mm = num(formData.get('largo_mm'))
  const ancho_mm = num(formData.get('ancho_mm'))
  const alto_mm = num(formData.get('alto_mm'))
  const imagen = formData.get('imagen') as File | null

  if (!codigo) return NextResponse.json({ error: 'El código es obligatorio' }, { status: 400 })
  if (!nombre) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

  const dimensiones = (largo_mm !== undefined || ancho_mm !== undefined || alto_mm !== undefined)
    ? { largo_mm, ancho_mm, alto_mm }
    : null

  // La tabla RLS de productos no admite insert desde el cliente de sesión
  // normal (solo service_role, mismo patrón que clientes/despachos) — se usa
  // admin client aquí, ya con el chequeo de rol de arriba como barrera real.
  const adminClient = createAdminClient()

  // Id generado acá (en vez de dejarlo al default de la tabla) para poder
  // nombrar el archivo de Storage con el id, no con el código: el código se
  // puede editar después desde /api/productos/[id], y usarlo como nombre de
  // archivo permite que un código liberado por un rename sea reutilizado por
  // otro producto y sobrescriba en Storage la foto de uno completamente
  // distinto (pasó con HK2347/HK2347BLACK, 2026-09-02).
  const id = randomUUID()

  let imagen_url: string | null = null
  let tiene_foto = false
  if (imagen && imagen.size > 0) {
    const ext = imagen.name.split('.').pop() || 'jpg'
    const fileName = `${id}.${ext}`
    const buffer = Buffer.from(await imagen.arrayBuffer())
    const { error: uploadError } = await adminClient.storage
      .from('productos')
      .upload(fileName, buffer, { contentType: imagen.type, upsert: true })
    if (uploadError) return NextResponse.json({ error: `Error subiendo imagen: ${uploadError.message}` }, { status: 500 })
    const { data: urlData } = adminClient.storage.from('productos').getPublicUrl(fileName)
    // Cache-bust: el bucket sirve con cache-control max-age=3600.
    imagen_url = `${urlData.publicUrl}?v=${Date.now()}`
    tiene_foto = true
  }

  const { data, error } = await adminClient
    .from('productos')
    .insert({
      id, codigo, nombre, descripcion, categoria_id, notas,
      precio_fob_usd, precio_mayorista, precio_detallista,
      cbm_unitario, moq, dimensiones, imagen_url, tiene_foto,
      estado: 'activo',
    })
    .select(`
      id, codigo, nombre, descripcion, imagen_url, dimensiones,
      precio_fob_usd, precio_mayorista, precio_detallista, cbm_unitario, moq,
      categoria:categorias_producto(id, nombre)
    `)
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `Ya existe un producto con el código "${codigo}"` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
