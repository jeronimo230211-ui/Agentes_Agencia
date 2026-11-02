import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { generarPDFFichaTecnica } from '@/lib/pdf/generator'
import { buscarClientePorToken } from '@/lib/solicitudToken'

type Params = { params: { id: string } }

// Sin cookies()/headers() Next.js (App Router, Next 14) cachearía el fetch a
// Supabase por defecto — mismo bug ya documentado en
// app/api/solicitud/[token]/route.ts. Acá no aplica tan directo (createAdminClient
// no usa cookies), pero se deja igual que el resto de rutas públicas por token
// para no reintroducirlo si alguien agrega lógica dependiente de sesión.
export const dynamic = 'force-dynamic'

// Descarga pública (sin sesión) de la ficha técnica en PDF, para el cliente
// que accede por su link fijo de pedido (/solicitud/[token]/producto/[id]).
// Hermano de app/api/productos/[id]/ficha-pdf/route.ts (ese requiere sesión
// interna) — NO lo reemplaza ni lo reusa como base porque la regla de acceso
// es distinta:
//   - Interno: usuario con sesión básica ve solo 'aprobada'; operaciones/admin
//     también puede ver el 'borrador' (para revisarlo antes de aprobarlo).
//   - Público (este archivo): SIEMPRE solo 'aprobada', sin excepción. Un
//     cliente externo jamás debe poder descargar la ficha de un producto que
//     todavía no se le mostró — no hay "rol" que lo salte acá.
export async function GET(req: NextRequest, { params }: Params) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token') || ''
  const idiomaParam = searchParams.get('idioma')
  const idioma: 'es' | 'en' = idiomaParam === 'es' ? 'es' : 'en'

  const adminClient = createAdminClient()

  // Mismo mecanismo de validación que el resto de rutas públicas por token
  // (regex + dos .eq() sueltos, nunca el token interpolado en un filtro) —
  // ver lib/solicitudToken.ts. Token inválido/expirado o cliente desactivado
  // => 401 sin detalle, para no revelar si el producto existe o no.
  const encontrado = await buscarClientePorToken(adminClient, token)
  if (!encontrado || !encontrado.cliente.activo) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })
  }

  // Select como un solo string literal (no concatenado) -- el tipado de
  // Supabase infiere el shape del resultado parseando este literal, y con
  // una concatenación de strings se pierde esa inferencia (TS lo ve como
  // `string` genérico, no como el literal real).
  const { data: producto, error } = await adminClient
    .from('productos')
    .select('id, codigo, nombre, proveedor, color_variante, imagen_url, imagenes_urls, descripcion_corta_es, descripcion_corta_en, descripcion_larga_es, descripcion_larga_en, ficha_tecnica, ficha_tecnica_estado, estado, categoria:categorias_producto(nombre)')
    .eq('id', params.id)
    .single()

  if (error || !producto) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  // Gate duro, sin excepción de rol (ver nota de arriba): una ficha en
  // 'borrador' nunca sale por esta ruta. 404 (no 403) para no confirmarle a
  // quien tenga el link que el producto existe pero está sin aprobar.
  // Auditoría de seguridad oct-2026: faltaba este chequeo de `estado` -- un
  // producto 'oculto'/'descontinuado'/'pendiente' (que getCatalogoPublico ya
  // excluye del catálogo) seguía pudiendo descargarse por esta ruta si
  // alguien conocía o adivinaba su UUID, porque esta ruta solo miraba
  // ficha_tecnica_estado. Mismo criterio que el catálogo: solo 'activo'.
  if (producto.ficha_tecnica_estado !== 'aprobada' || producto.estado !== 'activo') {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  // El join `categoria:categorias_producto(nombre)` vuelve como array
  // (Supabase no infiere la relación 1-a-1 por FK en el tipo) — se normaliza
  // al primer elemento antes de pasarlo a la plantilla, igual que el endpoint
  // interno.
  const categoriaJoin = producto.categoria as unknown as { nombre: string }[] | null
  const productoParaPdf = { ...producto, categoria: categoriaJoin?.[0] ?? null }

  // Igual que el PDF interno y el de proformas: se genera al vuelo en cada
  // request, sin cachear en Storage, para que nunca quede desactualizado
  // frente a la última edición de la ficha.
  const pdfBuffer = await generarPDFFichaTecnica(productoParaPdf, idioma)

  const nombreArchivo = `ficha-tecnica-${producto.codigo || producto.id}.pdf`
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nombreArchivo}"`,
    },
  })
}
