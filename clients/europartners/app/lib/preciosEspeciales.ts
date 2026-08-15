import type { SupabaseClient } from '@supabase/supabase-js'

export interface OverridePrecioEspecial {
  id: string
  precio_usd: number
  motivo: string | null
}

// Precio fijado a mano para UN cliente en UN producto puntual (ver migración
// 012, tabla precios_especiales_cliente) — se resuelve ANTES que
// productos.precio_mayorista/precio_detallista. Alcance actual: solo a nivel
// de producto completo (componente_id null), no por sub-línea de Hardware &
// Lumber. Se usa tanto desde el catálogo público (/solicitud/[token]) como
// desde la comparación histórica del cotizador manual.
//
// Trae TODOS los overrides activos del cliente (sin filtrar por lista de
// producto_id) — se espera que sean pocos por cliente (excepciones
// puntuales, no la norma). Filtrar con `.in('producto_id', [...cientos de
// ids del catálogo completo])` reventaba el límite de 16KB de headers de
// PostgREST cuando se llamaba desde el catálogo público (~477 productos),
// y la query fallaba en silencio devolviendo un mapa vacío — bug real
// encontrado probando esto en local el 2026-08-13.
export async function getPreciosEspeciales(
  client: SupabaseClient,
  clienteId: string
): Promise<Map<string, OverridePrecioEspecial>> {
  const mapa = new Map<string, OverridePrecioEspecial>()

  const { data } = await client
    .from('precios_especiales_cliente')
    .select('id, producto_id, precio_usd, motivo')
    .eq('cliente_id', clienteId)
    .is('componente_id', null)
    .eq('activo', true)

  for (const row of (data || []) as { id: string; producto_id: string; precio_usd: number; motivo: string | null }[]) {
    mapa.set(row.producto_id, { id: row.id, precio_usd: row.precio_usd, motivo: row.motivo })
  }
  return mapa
}
