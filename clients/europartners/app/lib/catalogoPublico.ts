import { createAdminClient } from './supabase-server'
import { precioPorTipo } from './precio'
import { getPreciosEspeciales } from './preciosEspeciales'
import type { TipoPrecio } from '@/types/europartners'

// Catálogo que ven el link público de pedido (/solicitud/[token]) y el link
// de edición tras una devolución (/solicitud-editar/[token]) — nunca expone
// precio_fob_usd (costo de Emily) ni ningún dato de margen. Solo se devuelve
// precio_cliente (ya resuelto según el tipo del cliente que pide el
// catálogo), nunca las columnas crudas precio_mayorista/precio_detallista.
//
// clienteId es opcional para no romper llamadores que todavía no lo pasen,
// pero sin él no se pueden aplicar precios especiales por cliente (ver
// migración 012) — pasarlo siempre que se conozca el cliente.
export async function getCatalogoPublico(adminClient: ReturnType<typeof createAdminClient>, tipoCliente: TipoPrecio, clienteId?: string) {
  const { data: categorias } = await adminClient
    .from('categorias_producto')
    .select('id, nombre, orden')
    .order('orden', { ascending: true })

  const { data: productosRaw } = await adminClient
    .from('productos')
    .select('id, categoria_id, codigo, nombre, descripcion, imagen_url, imagenes_urls, dimensiones, color_variante, moq, precio_mayorista, precio_detallista')
    .eq('estado', 'activo')
    .order('categoria_id', { ascending: true })
    .order('codigo', { ascending: true })

  const overrides = clienteId ? await getPreciosEspeciales(adminClient, clienteId) : new Map()

  const productos = (productosRaw || []).map(p => {
    const { precio_mayorista, precio_detallista, dimensiones, ...resto } = p
    const override = overrides.get(p.id)
    return {
      ...resto,
      dimensiones: formatDimensiones(dimensiones),
      precio_cliente: override?.precio_usd ?? precioPorTipo(precio_mayorista, precio_detallista, tipoCliente) ?? null,
    }
  })

  return { categorias: categorias || [], productos }
}

// productos.dimensiones es jsonb ({ largo_mm, ancho_mm, alto_mm? }), no texto
// — se formatea acá para que el frontend público solo reciba un string listo.
function formatDimensiones(d: unknown): string | null {
  if (!d || typeof d !== 'object') return null
  const { largo_mm, ancho_mm, alto_mm } = d as { largo_mm?: number; ancho_mm?: number; alto_mm?: number }
  const partes = [largo_mm, ancho_mm, alto_mm].filter((v): v is number => typeof v === 'number')
  if (partes.length === 0) return null
  return `${partes.join(' × ')} mm`
}
