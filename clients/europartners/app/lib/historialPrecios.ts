import type { SupabaseClient } from '@supabase/supabase-js'

interface LineaParaHistorial {
  producto_id?: string | null
  codigo_pdf?: string | null
  descripcion_pdf?: string | null
  precio_costo_usd?: number | null
  precio_cliente_usd?: number | null
  margen_pct?: number | null
}

interface ProformaParaHistorial {
  id: string
  numero: string
  fecha: string
  cliente_id: string
  lineas?: LineaParaHistorial[]
}

// Puebla historial_precios al aprobar una proforma — llamar SIEMPRE con un cliente
// adminClient (service role), la policy "historial_insert" solo permite insertar a
// service_role. Columnas reales de la tabla: cliente_id, producto_id, proforma_id,
// proforma_numero, fecha_proforma, codigo_pdf, descripcion_pdf, precio_costo_usd,
// precio_cliente_usd, margen_pct — NO tiene variante_id/componente_id (un bug previo
// insertaba esos dos campos, Postgres rechazaba el insert completo por columna
// inexistente, y como nadie revisaba el error, ninguna aprobación en vivo desde el
// 24-jul-2026 llegó a poblar esta tabla).
export async function poblarHistorialPrecios(
  adminClient: SupabaseClient,
  proforma: ProformaParaHistorial
): Promise<void> {
  const lineas = proforma.lineas || []
  const historialInserts = lineas.map(l => ({
    cliente_id: proforma.cliente_id,
    producto_id: l.producto_id,
    proforma_id: proforma.id,
    proforma_numero: proforma.numero,
    fecha_proforma: proforma.fecha,
    codigo_pdf: l.codigo_pdf,
    descripcion_pdf: l.descripcion_pdf,
    precio_costo_usd: l.precio_costo_usd,
    precio_cliente_usd: l.precio_cliente_usd,
    margen_pct: l.margen_pct,
  }))

  if (historialInserts.length === 0) return

  const { error } = await adminClient.from('historial_precios').insert(historialInserts)
  if (error) {
    console.error(`Error poblando historial_precios para proforma ${proforma.numero}:`, error.message)
  }
}
