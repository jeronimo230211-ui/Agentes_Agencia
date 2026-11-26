import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

// Heurística simple de detección de color/variante en `descripcion_pdf` --
// solo se usa para avisar al usuario que una referencia mezcla colores en su
// historial (bug real: TZ-3430H mostraba "White" en el header cuando la
// proforma 3-0211 facturó "Bone"), nunca para decidir qué color es correcto.
// \b evita que "ivory" matchee dentro de otra palabra.
// 'brass' se sacó de esta lista (BUG-H2): es el material del cuerpo de una
// grifería, no un acabado/color que varíe entre proformas -- aparece en la
// MISMA descripción junto al color real (ej. "Brass Single Handle Basin
// Faucet, Chrome Plate") y por eso marcaba color_mixto=true en referencias
// con una sola fila de historial (F90411, F90711, F90711MB, M32-2).
const COLORES_CONOCIDOS = [
  'white', 'bone', 'black', 'biscuit', 'ivory', 'almond', 'linen',
  'beige', 'ebony', 'grey', 'gray', 'silver', 'chrome', 'bronze',
]

function detectarColores(texto: string | null): Set<string> {
  const encontrados = new Set<string>()
  if (!texto) return encontrados
  const t = texto.toLowerCase()
  for (const color of COLORES_CONOCIDOS) {
    if (new RegExp(`\\b${color}\\b`, 'i').test(t)) {
      // grey/gray son el mismo color escrito distinto -- normalizar para no
      // marcar "color_mixto" cuando en realidad es el mismo tono.
      encontrados.add(color === 'gray' ? 'grey' : color)
    }
  }
  return encontrados
}

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
        codigo_pdf, descripcion_pdf, fecha_proforma,
        producto:productos (
          categoria:categorias_producto ( id, nombre )
        )
      `)
      .not('codigo_pdf', 'is', null)
      .order('codigo_pdf', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Deduplicar por codigo_pdf. La descripción/categoría representativa del
    // grupo es la de la fila con fecha_proforma MÁS RECIENTE -- antes se
    // usaba "la descripción más larga", lo cual hacía que una proforma vieja
    // (o de otro cliente) con una descripción casualmente más larga le
    // "robara" el nombre a todo el grupo, aunque el resto de las filas fueran
    // de otro color (bug real: TZ-3430H mostraba "White" en el header con
    // datos de la proforma 3-0254, mientras la proforma 3-0211 -- que sí
    // facturó "Bone" -- quedaba escondida debajo de ese nombre incorrecto).
    const map = new Map<string, {
      descripcion_pdf: string
      categoria_id: string | null
      categoria_nombre: string | null
      fecha_proforma: string | null
      // Firma de colores de CADA fila (no la unión de todos) -- "Array.from"
      // en vez de iterar el Set directo, igual que más abajo, para no
      // depender de --downlevelIteration/target ES2015 en tsconfig.
      firmas: Set<string>
    }>()
    for (const row of data || []) {
      const cod = (row.codigo_pdf || '').trim()
      if (!cod) continue
      const desc = (row.descripcion_pdf || '').trim()
      const fecha = row.fecha_proforma as string | null
      const cat = (row.producto as { categoria?: { id: string; nombre: string } } | null)?.categoria ?? null
      // BUG-H2: la firma es el CONJUNTO de colores de esta fila (orden
      // normalizado), no un color suelto -- así "white, bone" en todas las
      // filas de un grupo es una sola firma repetida, no mezcla.
      const firmaFila = Array.from(detectarColores(desc)).sort().join(',')

      const prev = map.get(cod)
      if (!prev) {
        map.set(cod, {
          descripcion_pdf: desc,
          categoria_id: cat?.id ?? null,
          categoria_nombre: cat?.nombre ?? null,
          fecha_proforma: fecha,
          firmas: new Set([firmaFila]),
        })
        continue
      }

      // Acumular la firma de TODAS las filas del grupo (no solo la
      // representativa) para poder detectar la mezcla real.
      prev.firmas.add(firmaFila)

      const esMasReciente = !!fecha && (!prev.fecha_proforma || fecha > prev.fecha_proforma)
      if (esMasReciente) {
        prev.descripcion_pdf = desc
        prev.fecha_proforma = fecha
        if (cat) {
          prev.categoria_id = cat.id
          prev.categoria_nombre = cat.nombre
        }
      }
    }

    let refs = Array.from(map.entries()).map(([codigo_pdf, v]) => ({
      codigo_pdf,
      descripcion_pdf: v.descripcion_pdf,
      categoria_id: v.categoria_id,
      categoria_nombre: v.categoria_nombre,
      // Aviso para que Deisy/Marta no vuelvan a confiar ciegamente en el
      // nombre del header -- cuando es true, hay filas con conjuntos de
      // colores DISTINTOS entre sí (mezcla real). Si todas las filas
      // mencionan exactamente la misma combinación de colores (incluida
      // "ninguno"), es nomenclatura consistente de un solo producto, no
      // variantes reales entre proformas (BUG-H2: F90411, F90711, etc.).
      color_mixto: v.firmas.size > 1,
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

    // BUG-H1: cada fila lleva su(s) propio(s) color(es) detectado(s) para que
    // el frontend los muestre SIEMPRE visibles (badge), sin depender de que
    // el usuario vea el final de una descripción truncada o haga hover.
    const dataConColor = (data || []).map(row => ({
      ...row,
      colores_detectados: Array.from(detectarColores(row.descripcion_pdf)),
    }))
    return NextResponse.json({ data: dataConColor })
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
