import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getCatalogoEmily } from '@/lib/catalogoEmily'
import { enviarNotificacionProformaChina } from '@/lib/email'

type Params = { params: { token: string } }

// Ruta pública — Emily accede desde su link fijo, sin login (mismo
// mecanismo que /api/solicitud/[token] de los clientes). Sin cookies(), así
// que Next.js no la detecta como dinámica automáticamente y cachearía el
// fetch a Supabase por defecto — ver la misma nota en app/api/solicitud.
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: Params) {
  const adminClient = createAdminClient()

  const { data: colaborador } = await adminClient
    .from('colaboradores_externos')
    .select('id, nombre, activo, categoria_ids')
    .eq('token', params.token)
    .single()

  if (!colaborador || !colaborador.activo) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  }

  const { categorias, productos } = await getCatalogoEmily(adminClient, colaborador.categoria_ids)

  return NextResponse.json({ nombre: colaborador.nombre, categorias, productos })
}

export async function POST(req: NextRequest, { params }: Params) {
  const adminClient = createAdminClient()

  const { data: colaborador } = await adminClient
    .from('colaboradores_externos')
    .select('id, nombre, activo, categoria_ids')
    .eq('token', params.token)
    .single()

  if (!colaborador || !colaborador.activo) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  }

  const body = await req.json()
  const lineasBody = Array.isArray(body.lineas) ? body.lineas : []
  const notas = typeof body.notas === 'string' ? body.notas.trim() || null : null

  if (lineasBody.length === 0) {
    return NextResponse.json({ error: 'Add at least one product' }, { status: 400 })
  }

  for (const l of lineasBody) {
    if (!l.producto_id || !l.cantidad || Number(l.cantidad) <= 0) {
      return NextResponse.json({ error: 'Invalid quantity in one of the lines' }, { status: 400 })
    }
    if (l.precio_fob_propuesto == null || Number(l.precio_fob_propuesto) <= 0) {
      return NextResponse.json({ error: 'Invalid price in one of the lines' }, { status: 400 })
    }
  }

  // Solo productos de las categorías que este colaborador tiene permitidas
  // — nunca confiar en los producto_id que manda el cliente sin validar.
  const productoIds = lineasBody.map((l: { producto_id: string }) => l.producto_id)
  const { data: productosPermitidos } = await adminClient
    .from('productos')
    .select('id, categoria_id, precio_fob_usd')
    .in('id', productoIds)
    .in('categoria_id', colaborador.categoria_ids)

  const permitidosPorId = new Map((productosPermitidos || []).map(p => [p.id, p]))
  const lineasValidas = lineasBody.filter((l: { producto_id: string }) => permitidosPorId.has(l.producto_id))

  if (lineasValidas.length === 0) {
    return NextResponse.json({ error: 'No valid products in the order' }, { status: 400 })
  }

  const { data: proformaChina, error } = await adminClient
    .from('proformas_china')
    .insert({ colaborador_id: colaborador.id, notas, estado: 'enviada' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const lineasInsert = lineasValidas.map((l: { producto_id: string; cantidad: number; precio_fob_propuesto: number; notas?: string }) => ({
    proforma_china_id: proformaChina.id,
    producto_id: l.producto_id,
    cantidad: Number(l.cantidad),
    precio_fob_propuesto: Number(l.precio_fob_propuesto),
    precio_fob_anterior: permitidosPorId.get(l.producto_id)?.precio_fob_usd ?? null,
    notas: l.notas || null,
  }))

  await adminClient.from('proformas_china_lineas').insert(lineasInsert)

  const { data: operativos } = await adminClient
    .from('usuarios')
    .select('id, email')
    .in('rol', ['operaciones', 'admin'])
    .eq('activo', true)

  if (operativos && operativos.length > 0) {
    await adminClient.from('notificaciones').insert(
      operativos.map(u => ({
        usuario_id: u.id,
        tipo: 'proforma_china_nueva',
        mensaje: `${colaborador.nombre} envió una proforma de China con ${lineasInsert.length} línea${lineasInsert.length !== 1 ? 's' : ''}`,
      }))
    )

    for (const u of operativos) {
      if (!u.email) continue
      try {
        await enviarNotificacionProformaChina(lineasInsert.length, u.email)
      } catch (e) {
        console.error('Error enviando email de proforma china nueva:', e instanceof Error ? e.message : String(e))
      }
    }
  }

  return NextResponse.json({ ok: true, proforma_china_id: proformaChina.id }, { status: 201 })
}
