import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { formatUSD } from '@/lib/precio'
import { enviarNotificacionComprobante } from '@/lib/email'
import { randomUUID } from 'crypto'

type Params = { params: { token: string } }

// Sin cookies()/headers()/searchParams (createAdminClient no depende de
// sesión, y el token viaja por path param, no query string), Next.js
// cachearía el fetch a Supabase por defecto — mismo bug real encontrado el
// 2026-08-13 en /api/solicitud/[token]/route.ts, aplica igual acá: sin esto
// el estado de pago/proforma que ve el cliente podría quedar pegado al de
// la primera visita después del build/redeploy.
export const dynamic = 'force-dynamic'

async function resolverToken(adminClient: ReturnType<typeof createAdminClient>, token: string) {
  const { data: tokenData } = await adminClient
    .from('tokens_pago')
    .select('proforma_id, expira_at')
    .eq('token', token)
    .single()

  if (!tokenData) return { error: 'Link not found', status: 404 } as const
  if (new Date(tokenData.expira_at) < new Date()) return { error: 'Link expired', status: 410 } as const

  return { proformaId: tokenData.proforma_id } as const
}

export async function GET(_req: NextRequest, { params }: Params) {
  const adminClient = createAdminClient()
  const resuelto = await resolverToken(adminClient, params.token)
  if ('error' in resuelto) return NextResponse.json({ error: resuelto.error }, { status: resuelto.status })

  const { data: proforma } = await adminClient
    .from('proformas')
    .select('id, numero, incoterm, total_fob_usd, total_cif_usd, estado_pago, comprobante_url, cliente:clientes(nombre)')
    .eq('id', resuelto.proformaId)
    .single()

  if (!proforma) return NextResponse.json({ error: 'Proforma not found' }, { status: 404 })

  const total = proforma.total_cif_usd || proforma.total_fob_usd || 0

  // Pago de flete (migración 024_pago_flete_despacho.sql) — el cliente ya
  // tiene este mismo link guardado desde que se creó su proforma, así que en
  // vez de generarle un link nuevo el día que arranca el despacho, se busca
  // acá si YA existe un despacho para esta proforma (relación 1:1, ver POST
  // /api/despachos) y, si existe, se le agrega al JSON de respuesta — el
  // frontend decide si muestra la sección de flete o no según si viene null.
  const { data: despacho } = await adminClient
    .from('despachos')
    .select('id, shipping_fee_usd')
    .eq('proforma_id', resuelto.proformaId)
    .maybeSingle()

  let despachoPago: {
    id: string
    total_formateado: string | null
    pagado_formateado: string
    estado_flete: 'pendiente' | 'parcial' | 'pagado'
  } | null = null

  if (despacho) {
    const { data: pagosFlete } = await adminClient
      .from('pagos')
      .select('monto')
      .eq('despacho_id', despacho.id)
      .eq('tipo', 'flete')

    const pagado = (pagosFlete || []).reduce((sum, p) => sum + Number(p.monto), 0)
    const totalFlete = despacho.shipping_fee_usd

    // `estado_flete` se calcula EN VIVO acá, igual que proformas_deuda_vivo
    // (021_tabla_pagos.sql) hace con la deuda de la proforma — no hay una
    // columna `estado_pago` para flete en `despachos` (no se necesita: no
    // hay ningún trigger ni flujo que dependa de guardarla, a diferencia de
    // proformas.estado_pago que sí bloquea la creación del despacho). Si
    // operaciones todavía no cargó `shipping_fee_usd` (null), no se puede
    // saber si ya se pagó todo — se deja 'pendiente' salvo que ya haya algo
    // abonado, en cuyo caso se muestra 'parcial'.
    despachoPago = {
      id: despacho.id,
      total_formateado: totalFlete != null ? formatUSD(totalFlete) : null,
      pagado_formateado: formatUSD(pagado),
      estado_flete: totalFlete != null && pagado >= totalFlete ? 'pagado' : pagado > 0 ? 'parcial' : 'pendiente',
    }
  }

  return NextResponse.json({
    proforma: {
      numero: proforma.numero,
      cliente_nombre: (proforma.cliente as { nombre?: string } | null)?.nombre,
      total_formateado: formatUSD(total),
      estado_pago: proforma.estado_pago,
      comprobante_url: proforma.comprobante_url,
      despacho: despachoPago,
    },
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const adminClient = createAdminClient()
  const resuelto = await resolverToken(adminClient, params.token)
  if ('error' in resuelto) return NextResponse.json({ error: resuelto.error }, { status: resuelto.status })

  const formData = await req.formData()
  const archivo = formData.get('comprobante') as File | null
  const montoRaw = formData.get('monto') as string | null
  // 'cliente' (default, sin cambios de comportamiento para el formulario
  // viejo de pago de factura) o 'flete' — migración 024_pago_flete_despacho.sql,
  // el mismo link público ahora también recibe el comprobante de flete del
  // despacho de esta proforma, en una sección aparte del frontend.
  const tipoRaw = (formData.get('tipo') as string | null) || 'cliente'
  const tipo: 'cliente' | 'flete' = tipoRaw === 'flete' ? 'flete' : 'cliente'

  if (!archivo) return NextResponse.json({ error: 'Upload the payment proof' }, { status: 400 })
  if (archivo.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'The file must not exceed 10MB' }, { status: 400 })

  // La tabla `pagos` (migración 021) exige monto > 0 — a diferencia del
  // modelo viejo, ya no se puede guardar un comprobante sin monto. El
  // frontend (app/pago/[token]/page.tsx) ahora lo pide como obligatorio.
  // Mismo criterio para flete: el cliente lo escribe a mano, sin OCR.
  const monto = montoRaw ? Number(montoRaw) : NaN
  if (!monto || isNaN(monto) || monto <= 0) {
    return NextResponse.json({ error: 'Enter the amount paid' }, { status: 400 })
  }

  // Para tipo='flete' tiene que existir un despacho para esta proforma —
  // si el cliente manda esta request es porque el frontend ya lo mostró
  // (GET de arriba solo expone la sección si hay despacho), pero se revalida
  // acá server-side por si el despacho se borró/cambió entre el GET y el POST.
  let despachoId: string | null = null
  if (tipo === 'flete') {
    const { data: despacho } = await adminClient
      .from('despachos')
      .select('id')
      .eq('proforma_id', resuelto.proformaId)
      .maybeSingle()
    if (!despacho) return NextResponse.json({ error: 'No shipment found for this quote yet' }, { status: 400 })
    despachoId = despacho.id
  }

  // Se registra en `pagos` (Registro Maestro Vivo, migración 021) en vez de
  // sobreescribir columnas de `proformas` — cada comprobante que sube el
  // cliente queda como una fila propia, con su propio archivo
  // (comprobantes/{pagoId}.{ext}, no comprobantes/{proformaId}-{timestamp}
  // como antes) para no pisar comprobantes anteriores. `registrado_por`
  // queda null porque no hay sesión (mismo caso que `tokens_pago`).
  const pagoId = randomUUID()
  const ext = archivo.name.split('.').pop() || 'bin'
  const fileName = `comprobantes/${pagoId}.${ext}`
  const buffer = Buffer.from(await archivo.arrayBuffer())

  const { error: uploadError } = await adminClient.storage
    .from('documentos')
    .upload(fileName, buffer, { contentType: archivo.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = adminClient.storage.from('documentos').getPublicUrl(fileName)

  const { error: pagoError } = await adminClient
    .from('pagos')
    .insert({
      id: pagoId,
      proforma_id: resuelto.proformaId,
      despacho_id: despachoId,
      tipo,
      monto,
      comprobante_url: urlData.publicUrl,
      registrado_por: null,
    })

  if (pagoError) return NextResponse.json({ error: pagoError.message }, { status: 500 })

  // El trigger trg_recalcular_estado_pago (migración 021) ya recalculó
  // proformas.estado_pago solo desde `pagos` tipo='cliente' — un pago de
  // flete no lo toca. Se relee la proforma acá para la notificación/email
  // de abajo (mismo flujo para ambos tipos, solo cambia el texto).
  const { data: proforma } = await adminClient
    .from('proformas')
    .select('numero, creada_por, cliente:clientes(nombre)')
    .eq('id', resuelto.proformaId)
    .single()

  if (proforma?.creada_por) {
    const clienteNombre = (proforma.cliente as { nombre?: string } | null)?.nombre || 'Cliente'
    const mensajeConcepto = tipo === 'flete' ? 'comprobante de pago de FLETE' : 'comprobante de pago'

    await adminClient.from('notificaciones').insert({
      usuario_id: proforma.creada_por,
      tipo: 'comprobante_subido',
      mensaje: `${clienteNombre} subió el ${mensajeConcepto} de la proforma ${proforma.numero} — pendiente de validar`,
    })

    const { data: creador } = await adminClient.from('usuarios').select('email').eq('id', proforma.creada_por).single()
    if (creador?.email) {
      try {
        await enviarNotificacionComprobante(proforma.numero, clienteNombre, monto, resuelto.proformaId, creador.email, tipo === 'flete' ? 'flete' : 'factura')
      } catch (e) {
        console.error('Error enviando email de comprobante subido:', e instanceof Error ? e.message : String(e))
        // No fallar el request si el email falla — la notificación in-app ya se guardó
      }
    }
  }

  return NextResponse.json({ ok: true })
}
