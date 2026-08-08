import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-server'

type Params = { params: { id: string } }

function num(v: FormDataEntryValue | null): number | null {
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Edición de un producto ya cargado — antes solo existía alta (POST /api/productos),
// no había forma de corregir nombre/descripción/precio desde la app (pendiente #26).
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado para editar productos' }, { status: 403 })
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

  const dimensiones = (largo_mm !== null || ancho_mm !== null || alto_mm !== null)
    ? { largo_mm, ancho_mm, alto_mm }
    : null

  // Mismo patrón que el resto de rutas de escritura: la RLS de productos solo
  // admite service_role, el chequeo de rol de arriba es la barrera real.
  const adminClient = createAdminClient()

  const update: Record<string, unknown> = {
    codigo, nombre, descripcion, categoria_id, notas,
    precio_fob_usd, precio_mayorista, precio_detallista,
    cbm_unitario, moq, dimensiones,
    updated_at: new Date().toISOString(),
  }

  // Es un formulario completo (no un PATCH parcial): los campos vacíos se
  // guardan como null a propósito, para poder borrar un precio/nota existente.
  if (imagen && imagen.size > 0) {
    const ext = imagen.name.split('.').pop() || 'jpg'
    const fileName = `${codigo}.${ext}`
    const buffer = Buffer.from(await imagen.arrayBuffer())
    const { error: uploadError } = await adminClient.storage
      .from('productos')
      .upload(fileName, buffer, { contentType: imagen.type, upsert: true })
    if (uploadError) return NextResponse.json({ error: `Error subiendo imagen: ${uploadError.message}` }, { status: 500 })
    const { data: urlData } = adminClient.storage.from('productos').getPublicUrl(fileName)
    update.imagen_url = urlData.publicUrl
    update.tiene_foto = true
  }

  const { data, error } = await adminClient
    .from('productos')
    .update(update)
    .eq('id', params.id)
    .select(`
      id, codigo, nombre, descripcion, imagen_url, dimensiones,
      precio_fob_usd, precio_mayorista, precio_detallista, cbm_unitario, moq, notas,
      categoria:categorias_producto(id, nombre)
    `)
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `Ya existe un producto con el código "${codigo}"` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
