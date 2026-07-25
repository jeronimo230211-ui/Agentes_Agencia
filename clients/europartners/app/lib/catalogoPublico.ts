import { createAdminClient } from './supabase-server'

// Catálogo que ven el link público de pedido (/solicitud/[token]) y el link
// de edición tras una devolución (/solicitud-editar/[token]) — nunca expone
// precio_fob_usd (costo de Emily) ni ningún dato de margen.
export async function getCatalogoPublico(adminClient: ReturnType<typeof createAdminClient>) {
  const { data: categorias } = await adminClient
    .from('categorias_producto')
    .select('id, nombre, orden')
    .order('orden', { ascending: true })

  const { data: productos } = await adminClient
    .from('productos')
    .select('id, categoria_id, codigo, nombre, descripcion, imagen_url')
    .eq('estado', 'activo')
    .order('categoria_id', { ascending: true })
    .order('codigo', { ascending: true })

  return { categorias: categorias || [], productos: productos || [] }
}
