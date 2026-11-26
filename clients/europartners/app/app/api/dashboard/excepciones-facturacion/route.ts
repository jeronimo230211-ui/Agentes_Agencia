import { NextResponse } from 'next/server'
import { getCurrentUsuario } from '@/lib/auth'

// GET /api/dashboard/excepciones-facturacion — tile "Excepciones de
// facturación" del tab Estratégico del Dashboard (ver migración
// 033_snapshot_lineas_enviadas_cliente.sql). Lista las proformas YA
// FACTURADAS cuyo total facturado quedó distinto del total que se cotizó y
// envió al cliente (snapshot 'enviada_cliente') -- encargo de Deisy:
// detectar ventas que cambiaron entre el envío y la factura sin que nadie
// se diera cuenta.
//
// Acceso: admin + analista -- mismo criterio que /api/finanzas y
// /api/dashboard/indicadores-estrategicos (información analítica, no la
// cola de acción de operaciones). Gate en el backend, no solo en el
// frontend.
const ROLES_EXCEPCIONES = ['admin', 'analista']

export async function GET() {
  const ctx = await getCurrentUsuario()
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!ROLES_EXCEPCIONES.includes(ctx.usuario.rol)) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }
  const { supabase } = ctx

  // tiene_snapshot=true es obligatorio acá, no opcional: una proforma
  // facturada ANTES de esta migración (o cualquiera que nunca pasó por el
  // flujo de snapshot) no tiene con qué compararse -- su
  // total_snapshot_cliente_usd vendría en 0 por ausencia de filas de
  // snapshot, no porque de verdad se haya cotizado $0, y eso la haría
  // aparecer como una "excepción" del 100% del total facturado. Ver nota
  // de `tiene_snapshot` en la cabecera de la migración 033.
  const { data, error } = await supabase
    .from('proforma_totales_comparacion_v')
    .select('*')
    .eq('estado', 'facturada')
    .eq('tiene_snapshot', true)

  // Regla de datos de la agencia: nunca tragar un error de la BD.
  if (error) {
    console.error('[excepciones-facturacion] error consultando proforma_totales_comparacion_v:', error.message)
    return NextResponse.json({ error: 'No se pudieron cargar las excepciones de facturación' }, { status: 500 })
  }

  // Redondeo a centavos antes de comparar -- evita que un residuo de coma
  // flotante marque como "excepción" una proforma que en la práctica no
  // cambió. Ordenado por magnitud de diferencia, mayor primero (lo que pidió
  // Jero para que lo más grave quede arriba).
  const excepciones = (data || [])
    .map(t => {
      const diferencia_usd = Math.round(((t.total_actual_cliente_usd ?? 0) - (t.total_snapshot_cliente_usd ?? 0)) * 100) / 100
      const diferencia_pct = t.total_snapshot_cliente_usd > 0
        ? Math.round((diferencia_usd / t.total_snapshot_cliente_usd) * 1000) / 10
        : null
      return { ...t, diferencia_usd, diferencia_pct }
    })
    .filter(t => t.diferencia_usd !== 0)
    .sort((a, b) => Math.abs(b.diferencia_usd) - Math.abs(a.diferencia_usd))

  return NextResponse.json({ data: excepciones })
}
