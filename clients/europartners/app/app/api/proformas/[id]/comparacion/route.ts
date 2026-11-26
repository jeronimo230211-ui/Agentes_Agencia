import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

type Params = { params: { id: string } }

// GET /api/proformas/[id]/comparacion — datos para la caja "Cotizado vs.
// facturado" del detalle de proforma (ver migración
// 033_snapshot_lineas_enviadas_cliente.sql, encargo de Deisy: detectar
// cuando lo que el cliente aprobó termina siendo distinto de lo que se le
// factura). Consume las 2 vistas de esa migración con el cliente de SESIÓN
// normal -- ambas tienen security_invoker=true (heredan RLS de
// proforma_lineas_snapshot/proforma_lineas/proformas), igual que el resto
// de GETs de este módulo no hace falta admin client acá.
//
// Acceso: cualquier autenticado que pueda ver el detalle de la proforma
// (mismo gate que GET /api/proformas/[id] y GET /pagos) -- no es
// información más sensible que el resto de la proforma, que ya ve
// cualquier rol en esta pantalla.
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const [totalesRes, lineasRes] = await Promise.all([
    supabase
      .from('proforma_totales_comparacion_v')
      .select('*')
      .eq('proforma_id', params.id)
      .maybeSingle(),
    supabase
      .from('proforma_lineas_comparacion_v')
      .select('*')
      .eq('proforma_id', params.id),
  ])

  // Regla de datos de la agencia: nunca tragar un error de la BD -- corta
  // con un 500 real en vez de mostrarle a Deisy una comparación a medias.
  if (totalesRes.error || lineasRes.error) {
    console.error(
      '[proformas/comparacion] error consultando vistas de comparación:',
      totalesRes.error?.message, lineasRes.error?.message,
    )
    return NextResponse.json({ error: 'No se pudo cargar la comparación de facturación' }, { status: 500 })
  }

  // Líneas caídas y agregadas primero -- son las más fáciles de pasar por
  // alto (motivo original del encargo); luego las que cambiaron de
  // cantidad/precio; al final las que coinciden sin cambio.
  const PRIORIDAD_ESTADO: Record<string, number> = { caida: 0, agregada: 1 }
  const lineas = [...(lineasRes.data || [])].sort((a, b) => {
    const pa = PRIORIDAD_ESTADO[a.estado_linea as string] ?? (a.cambio_detectado ? 2 : 3)
    const pb = PRIORIDAD_ESTADO[b.estado_linea as string] ?? (b.cambio_detectado ? 2 : 3)
    if (pa !== pb) return pa - pb
    const cmp = (a.match_key as string).localeCompare(b.match_key as string)
    return cmp !== 0 ? cmp : (a.rn as number) - (b.rn as number)
  })

  return NextResponse.json({ data: { totales: totalesRes.data ?? null, lineas } })
}
