import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-server'
import { generarPDFFichaTecnica } from '@/lib/pdf/generator'

type Params = { params: { id: string } }

// Descarga la ficha técnica de un producto en PDF. Requiere sesión (no es
// público): el mismo producto puede tener una ficha 'borrador' que todavía
// no se le muestra al cliente final (ver migración 014 y aprobar-ficha/route.ts).
// Un usuario con sesión normal (no operaciones/admin) solo puede ver el PDF
// de una ficha ya aprobada; operaciones/admin puede ver también el borrador,
// para revisarlo antes de aprobarlo.
export async function GET(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  const esOperacionesOAdmin = Boolean(usuario && ['operaciones', 'admin'].includes(usuario.rol))

  const { searchParams } = new URL(req.url)
  const idiomaParam = searchParams.get('idioma')
  const idioma: 'es' | 'en' = idiomaParam === 'en' ? 'en' : 'es'

  const adminClient = createAdminClient()
  const { data: producto, error } = await adminClient
    .from('productos')
    .select('id, codigo, nombre, proveedor, color_variante, imagen_url, imagenes_urls, descripcion_corta_es, descripcion_corta_en, descripcion_larga_es, descripcion_larga_en, ficha_tecnica, ficha_tecnica_estado, categoria:categorias_producto(nombre)')
    .eq('id', params.id)
    .single()

  if (error || !producto) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }

  // No se expone el PDF de una ficha en borrador a cualquiera con sesión
  // básica — solo operaciones/admin puede verla antes de aprobarla. Se
  // devuelve 404 (no 403) para no revelar que existe un borrador.
  if (producto.ficha_tecnica_estado !== 'aprobada' && !esOperacionesOAdmin) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }

  // El join `categoria:categorias_producto(nombre)` vuelve como array
  // (Supabase no infiere la relación 1-a-1 por FK en el tipo) — se
  // normaliza al primer elemento antes de pasarlo a la plantilla.
  const categoriaJoin = producto.categoria as unknown as { nombre: string }[] | null
  const productoParaPdf = { ...producto, categoria: categoriaJoin?.[0] ?? null }

  // Igual que el PDF de proformas: se genera al vuelo en cada request, sin
  // cachear en Storage, para que nunca quede desactualizado frente a la
  // última edición de la ficha o de los datos del producto.
  const pdfBuffer = await generarPDFFichaTecnica(productoParaPdf, idioma)

  const nombreArchivo = `ficha-tecnica-${producto.codigo || producto.id}.pdf`
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nombreArchivo}"`,
    },
  })
}
