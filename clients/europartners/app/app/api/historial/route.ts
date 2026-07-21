import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
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

  // ── Modo detalle: historial completo de un código específico ──
  if (modo === 'detalle' && codigo) {
    let query = supabase
      .from('historial_precios')
      .select(`
        id, proforma_numero, fecha_proforma,
        precio_costo_usd, precio_cliente_usd, margen_pct,
        codigo_pdf, descripcion_pdf,
        clientes ( id, nombre )
      `)
      .eq('codigo_pdf', codigo)
      .order('fecha_proforma', { ascending: false })

    if (cliente_id) query = query.eq('cliente_id', cliente_id)

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
