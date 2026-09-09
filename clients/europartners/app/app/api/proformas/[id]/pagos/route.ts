import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'

type Params = { params: { id: string } }

// Historial de pagos de una proforma (Registro Maestro Vivo, ver migración
// 021_tabla_pagos.sql). Reemplaza el modelo viejo de "un solo pago por
// proforma" — ahora hay N filas, tanto de cobro al cliente (tipo='cliente')
// como de pago al proveedor en China (tipo='china'). `estado_pago` en
// `proformas` se recalcula solo por trigger cuando cambian filas acá.
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // RLS de `pagos` (read_auth) ya permite a cualquier autenticado leer — no
  // hace falta admin client acá, mismo patrón que el GET de solicitudes/[id].
  const { data, error } = await supabase
    .from('pagos')
    .select('*, usuario:usuarios(nombre)')
    .eq('proforma_id', params.id)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// Registra un pago (cliente o China) sobre una proforma. Restringido a
// operaciones/admin — mismo patrón de rol que confirmar-pago/despachos/
// precios-especiales: el rol se valida leyendo `usuarios.rol` con el cliente
// de sesión, pero el INSERT real se hace con createAdminClient() porque RLS
// de `pagos` solo permite escritura a service_role.
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado para registrar pagos' }, { status: 403 })
  }

  const formData = await req.formData()
  const tipo = formData.get('tipo') as string | null
  const montoRaw = formData.get('monto') as string | null
  const comisionRaw = formData.get('comision_bancaria') as string | null
  const referencia = (formData.get('referencia') as string | null)?.trim() || null
  const fechaRaw = (formData.get('fecha') as string | null)?.trim() || null
  const nota = (formData.get('nota') as string | null)?.trim() || null
  const archivo = formData.get('comprobante') as File | null

  if (!tipo || !['cliente', 'china'].includes(tipo)) {
    return NextResponse.json({ error: 'Tipo de pago inválido' }, { status: 400 })
  }

  const monto = montoRaw ? Number(montoRaw) : NaN
  if (!monto || isNaN(monto) || monto <= 0) {
    return NextResponse.json({ error: 'Ingresa un monto válido' }, { status: 400 })
  }

  const comision_bancaria = comisionRaw ? Number(comisionRaw) : 0
  if (isNaN(comision_bancaria) || comision_bancaria < 0) {
    return NextResponse.json({ error: 'Comisión bancaria inválida' }, { status: 400 })
  }

  if (archivo && archivo.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'El comprobante no debe superar 10MB' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data: proforma } = await adminClient.from('proformas').select('id').eq('id', params.id).maybeSingle()
  if (!proforma) return NextResponse.json({ error: 'Proforma no encontrada' }, { status: 404 })

  // Se genera el id acá (en vez de dejarlo al default de la tabla) porque el
  // nombre del archivo de comprobante debe incluir el id del pago — ver
  // comentario de la migración 021 sobre `comprobantes/{pagoId}.{ext}`.
  const pagoId = randomUUID()
  let comprobante_url: string | null = null

  if (archivo && archivo.size > 0) {
    const ext = archivo.name.split('.').pop() || 'bin'
    const fileName = `comprobantes/${pagoId}.${ext}`
    const buffer = Buffer.from(await archivo.arrayBuffer())

    const { error: uploadError } = await adminClient.storage
      .from('documentos')
      .upload(fileName, buffer, { contentType: archivo.type, upsert: true })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: urlData } = adminClient.storage.from('documentos').getPublicUrl(fileName)
    comprobante_url = urlData.publicUrl
  }

  const { data, error } = await adminClient
    .from('pagos')
    .insert({
      id: pagoId,
      proforma_id: params.id,
      tipo,
      monto,
      comision_bancaria,
      referencia,
      comprobante_url,
      fecha: fechaRaw || new Date().toISOString().split('T')[0],
      registrado_por: session.user.id,
      nota,
    })
    .select('*, usuario:usuarios(nombre)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
