import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '../../app/.env.local' })

let _client = null
function getClient() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    )
  }
  return _client
}

// Obtiene el mapa de clientes (slug → id)
export async function getClientesMap() {
  const { data } = await getClient().from('clientes').select('id, slug, incoterm, modo_pricing')
  const map = {}
  for (const c of data || []) map[c.slug] = c
  return map
}

// Obtiene parámetros de precio activos
export async function getParametrosPrecio() {
  const { data } = await getClient().from('parametros_precio').select('*').eq('activo', true).limit(1).single()
  return data
}

// Inserta o actualiza una proforma y sus líneas (idempotente por número)
export async function upsertProforma(clienteId, parametrosPrecioId, proformaData, lineas) {
  const supabase = getClient()

  // Verificar si ya existe
  const { data: existente } = await supabase
    .from('proformas')
    .select('id')
    .eq('numero', proformaData.numero)
    .single()

  if (existente) {
    console.log(`    → YA EXISTE: ${proformaData.numero}`)
    return existente.id
  }

  const { data: pf, error } = await supabase
    .from('proformas')
    .insert({
      numero: proformaData.numero,
      cliente_id: clienteId,
      parametros_precio_id: parametrosPrecioId,
      fecha: proformaData.fecha || new Date().toISOString().split('T')[0],
      incoterm: proformaData.incoterm || 'FOB',
      modo_pricing: proformaData.modo_pricing || 'set',
      total_fob_usd: proformaData.total_fob_usd,
      total_flete_usd: proformaData.total_flete_usd,
      total_cif_usd: proformaData.total_cif_usd,
      estado: 'enviada', // Datos históricos ya fueron enviados
      importado_de_excel: true,
      archivo_origen: proformaData.archivo_origen,
    })
    .select('id')
    .single()

  if (error) {
    console.error(`    ERROR insertando proforma ${proformaData.numero}: ${error.message}`)
    return null
  }

  // Insertar líneas
  if (lineas.length > 0) {
    const lineasInsert = lineas.map((l, i) => ({
      proforma_id: pf.id,
      orden: i,
      descripcion_pdf: l.descripcion_pdf || l.descripcion || '',
      codigo_pdf: l.codigo_pdf || l.codigo_tangshan || '',
      cantidad: l.cantidad || 1,
      precio_costo_usd: l.precio_costo_usd || l.precio_fob_usd,
      precio_cliente_usd: l.precio_cliente_usd,
      margen_pct: l.margen_pct || (
        l.precio_costo_usd && l.precio_cliente_usd
          ? l.precio_cliente_usd / l.precio_costo_usd - 1
          : null
      ),
      subtotal_costo_usd: l.precio_costo_usd
        ? l.precio_costo_usd * (l.cantidad || 1)
        : null,
      subtotal_cliente_usd: l.precio_cliente_usd
        ? l.precio_cliente_usd * (l.cantidad || 1)
        : null,
    }))

    const { error: lineasError } = await supabase.from('proforma_lineas').insert(lineasInsert)
    if (lineasError) {
      console.error(`    ERROR insertando líneas: ${lineasError.message}`)
    }
  }

  // Poblar historial_precios
  const historialInserts = construirHistorial(clienteId, pf.id, proformaData, lineas)
  if (historialInserts.length > 0) {
    const { error: histError } = await supabase.from('historial_precios').insert(historialInserts)
    if (histError) console.error(`    ERROR historial: ${histError.message}`)
  }

  return pf.id
}

/**
 * Construye inserts de historial_precios.
 * Para modo 'componente' (H&L): agrupa líneas por código y suma precio_cliente.
 * Para modo 'set': una entrada por línea.
 * El campo descripcion_pdf requiere ALTER TABLE (ver instrucciones en README).
 */
function construirHistorial(clienteId, proformaId, proformaData, lineas) {
  const base = {
    cliente_id: clienteId,
    proforma_id: proformaId,
    proforma_numero: proformaData.numero,
    fecha_proforma: proformaData.fecha,
  }

  const modo = proformaData.modo_pricing || 'set'

  if (modo === 'componente') {
    // Para H&L: el PI da el costo por SET completo; la proforma da componentes separados.
    // Agrupamos por código → precio_costo = precio de PI (mismo para todos),
    // precio_cliente = SUMA de componentes (lo que paga el cliente por el set completo).
    const grupos = new Map()
    for (const l of lineas) {
      if (!l.precio_cliente_usd) continue
      const key = (l.codigo_pdf || l.descripcion_pdf || '').toUpperCase()
      if (!key) continue
      if (!grupos.has(key)) {
        grupos.set(key, {
          codigo_pdf: l.codigo_pdf || '',
          descripcion_pdf: l.descripcion_pdf || l.codigo_pdf || '',
          precio_costo_usd: l.precio_costo_usd || null,
          precio_cliente_usd: 0,
        })
      }
      const g = grupos.get(key)
      g.precio_cliente_usd += l.precio_cliente_usd
      // Tomar el costo del PI (mismo para todos los componentes del mismo código)
      if (!g.precio_costo_usd && l.precio_costo_usd) g.precio_costo_usd = l.precio_costo_usd
    }
    return Array.from(grupos.values()).map(g => ({
      ...base,
      codigo_pdf: g.codigo_pdf,
      descripcion_pdf: g.descripcion_pdf,
      precio_costo_usd: g.precio_costo_usd,
      precio_cliente_usd: g.precio_cliente_usd || null,
      margen_pct: g.precio_costo_usd && g.precio_cliente_usd
        ? g.precio_cliente_usd / g.precio_costo_usd - 1
        : null,
    }))
  }

  // Modo 'set': una entrada por línea con precio_cliente
  return lineas
    .filter(l => l.precio_cliente_usd)
    .map(l => ({
      ...base,
      codigo_pdf: l.codigo_pdf || '',
      descripcion_pdf: l.descripcion_pdf || l.codigo_pdf || '',
      precio_costo_usd: l.precio_costo_usd || null,
      precio_cliente_usd: l.precio_cliente_usd,
      margen_pct: l.margen_pct || (
        l.precio_costo_usd && l.precio_cliente_usd
          ? l.precio_cliente_usd / l.precio_costo_usd - 1
          : null
      ),
    }))
}

// Resetear la secuencia después de importar históricos
export async function ajustarSecuencia(ultimoNumero) {
  // Parse "3-0213" → 213
  const match = String(ultimoNumero).match(/3-(\d+)/)
  if (!match) return

  const num = parseInt(match[1])
  const supabase = getClient()
  const { error } = await supabase.rpc('setval', { seq_name: 'proforma_numero_seq', value: num + 1 })
  if (error) {
    console.log(`  Ajuste manual necesario — ejecuta en Supabase SQL Editor:`)
    console.log(`  ALTER SEQUENCE proforma_numero_seq RESTART WITH ${num + 1};`)
  }
}
