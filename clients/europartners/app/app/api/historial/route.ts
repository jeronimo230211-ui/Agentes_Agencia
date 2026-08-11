import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const modo = searchParams.get('modo') // 'referencias' | 'detalle'
  const codigo = searchParams.get('codigo')
  const cliente_id = searchParams.get('cliente_id')
  const q = (searchParams.get('q') || '').trim()

  // ── Modo referencias: lista única de códigos para el panel izquierdo ──
  if (modo === 'referencias') {
    const { data, error } = await supabase
      .from('historial_precios')
      .select(`
        codigo_pdf, descripcion_pdf,
        producto:productos (
          categoria:categorias_producto ( id, nombre )
        )
      `)
      .not('codigo_pdf', 'is', null)
      .order('codigo_pdf', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Deduplicar por codigo_pdf, conservar descripción más larga + categoría
    const map = new Map<string, { descripcion_pdf: string; categoria_id: string | null; categoria_nombre: string | null }>()
    for (const row of data || []) {
      const cod = (row.codigo_pdf || '').trim()
      if (!cod) continue
      const desc = (row.descripcion_pdf || '').trim()
      const cat = (row.producto as { categoria?: { id: string; nombre: string } } | null)?.categoria ?? null
      const prev = map.get(cod)
      if (!prev || desc.length > prev.descripcion_pdf.length) {
        map.set(cod, {
          descripcion_pdf: desc,
          categoria_id: cat?.id ?? null,
          categoria_nombre: cat?.nombre ?? null,
        })
      }
    }

    let refs = Array.from(map.entries()).map(([codigo_pdf, v]) => ({
      codigo_pdf,
      ...v,
    }))

    if (q) {
      const ql = q.toLowerCase()
      refs = refs.filter(r =>
        r.codigo_pdf.toLowerCase().includes(ql) ||
        r.descripcion_pdf.toLowerCase().includes(ql)
      )
    }

    return NextResponse.json({ data: refs, total: refs.length })
  }

  // ── Modo detalle: historial de un código, de un cliente, o la combinación de ambos ──
  if (modo === 'detalle' && (codigo || cliente_id)) {
    let query = supabase
      .from('historial_precios')
      .select(`
        id, proforma_numero, fecha_proforma,
        precio_costo_usd, precio_cliente_usd, margen_pct,
        codigo_pdf, descripcion_pdf,
        clientes ( id, nombre )
      `)
      .order('fecha_proforma', { ascending: false })

    if (codigo) query = query.eq('codigo_pdf', codigo)
    if (cliente_id) query = query.eq('cliente_id', cliente_id)
    // Sin código (navegando solo por cliente, todas sus referencias) el resultado puede
    // ser grande — se acota para que la pantalla siga siendo usable.
    if (!codigo) query = query.limit(300)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  // ── Modo legacy: búsqueda por texto (mantener compatibilidad) ──
  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'q debe tener al menos 2 caracteres' }, { status: 400 })
  }

  let query = supabase
    .from('historial_precios')
    .select(`
      id, proforma_numero, fecha_proforma,
      precio_costo_usd, precio_cliente_usd, margen_pct,
      codigo_pdf, descripcion_pdf,
      clientes ( nombre )
    `)
    .or(`descripcion_pdf.ilike.%${q}%,codigo_pdf.ilike.%${q}%`)
    .order('fecha_proforma', { ascending: false })
    .limit(100)

  if (cliente_id) query = query.eq('cliente_id', cliente_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// Precio de referencia cargado a mano por Deisy/Marta cuando no existe historial en el sistema
// (por ejemplo, encontrado en una proforma vieja fuera de la app) — mismo destino que el
// historial que se genera al aprobar una proforma, para que alimente la comparación de precios.
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const cliente_id = body.cliente_id as string | undefined
  const codigo_pdf = (body.codigo_pdf as string | undefined)?.trim()
  const precio_cliente_usd = Number(body.precio_cliente_usd)
  const fecha_proforma = body.fecha_proforma as string | undefined
  const proforma_numero = (body.proforma_numero as string | undefined)?.trim() || null

  if (!cliente_id || !codigo_pdf || !fecha_proforma || !precio_cliente_usd || precio_cliente_usd <= 0) {
    return NextResponse.json({ error: 'Faltan datos: cliente, código, precio y fecha son obligatorios' }, { status: 400 })
  }

  const { data: producto } = await supabase
    .from('productos')
    .select('id, descripcion')
    .eq('codigo', codigo_pdf)
    .maybeSingle()

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('historial_precios')
    .insert({
      cliente_id,
      producto_id: producto?.id ?? null,
      codigo_pdf,
      descripcion_pdf: producto?.descripcion ?? null,
      precio_cliente_usd,
      fecha_proforma,
      proforma_numero,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
