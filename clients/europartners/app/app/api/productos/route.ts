import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const categoria_id = searchParams.get('categoria_id')
  const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500)
  const offset = parseInt(searchParams.get('offset') || '0')

  let query = supabase
    .from('productos')
    .select(`
      id, codigo, nombre, descripcion, imagen_url, dimensiones,
      precio_fob_usd, precio_fob_fecha, estado, notas,
      precio_mayorista, precio_detallista, cbm_unitario, moq, color_variante,
      tiene_historial, veces_vendido, fecha_ultima_venta, precio_cliente_historico_ultimo,
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
