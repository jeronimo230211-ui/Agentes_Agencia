import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getCatalogoPublico } from '@/lib/catalogoPublico'
import { buscarClientePorToken } from '@/lib/solicitudToken'

type Params = { params: { token: string; id: string } }

// Mismo bug real de cacheo que /api/solicitud/[token]/route.ts (2026-08-13):
// sin cookies()/headers(), Next cachearía el fetch a Supabase por defecto.
export const dynamic = 'force-dynamic'

// Detalle público de UN producto, para app/solicitud/[token]/producto/[id].
// Reusa getCatalogoPublico (no reimplementa el cálculo de precio/overrides
// por cliente ni el gating de la ficha técnica) y simplemente filtra el
// catálogo completo al producto pedido + sus relacionados de la misma
// categoría. Mismo patrón de validación de token que la ruta del listado
// (buscarClientePorToken), nunca interpolando el token en un filtro.
export async function GET(_req: NextRequest, { params }: Params) {
  const adminClient = createAdminClient()

  const encontrado = await buscarClientePorToken(adminClient, params.token)
  const cliente = encontrado?.cliente

  if (!encontrado || !cliente || !cliente.activo) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  }

  const { productos } = await getCatalogoPublico(adminClient, encontrado.tipoPrecio, cliente.id)

  const producto = productos.find(p => p.id === params.id)
  if (!producto) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const relacionados = producto.categoria_id
    ? productos.filter(p => p.id !== producto.id && p.categoria_id === producto.categoria_id).slice(0, 8)
    : []

  return NextResponse.json({
    cliente: { nombre: cliente.nombre, contactoCompleto: !!cliente.contacto_email },
    producto,
    relacionados,
  })
}
