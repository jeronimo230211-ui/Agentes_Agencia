import { createAdminClient } from './supabase-server'

// Catálogo que ve Emily en su link (/emily/[token]) — módulo aparte del
// catálogo público de clientes (lib/catalogoPublico.ts), a propósito: acá
// SÍ se expone precio_fob_usd (el costo), porque es justo el dato que
// Emily debe poder revisar y proponer actualizar. Nunca reusar esta
// función para nada cliente-facing.
export async function getCatalogoEmily(adminClient: ReturnType<typeof createAdminClient>, categoriaIds: string[]) {
  const { data: categorias } = await adminClient
    .from('categorias_producto')
    .select('id, nombre, orden')
    .in('id', categoriaIds)
    .order('orden', { ascending: true })

  const { data: productos } = await adminClient
    .from('productos')
    .select('id, categoria_id, codigo, nombre, imagen_url, precio_fob_usd')
    .in('categoria_id', categoriaIds)
    .eq('estado', 'activo')
    .order('categoria_id', { ascending: true })
    .order('codigo', { ascending: true })

  return { categorias: categorias || [], productos: productos || [] }
}
