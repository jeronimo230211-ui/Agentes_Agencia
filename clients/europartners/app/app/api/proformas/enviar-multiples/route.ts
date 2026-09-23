import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-server'
import { generarPDFProforma } from '@/lib/pdf/generator'
import { enviarProformasCliente } from '@/lib/email'
import { cookies } from 'next/headers'
import type { Proforma } from '@/types/europartners'

interface ErrorItem { id: string; numero?: string; error: string }

// Envío en lote de varias proformas 'aprobada' en un solo correo por cliente
// (feature 2, Jero 2026-09-22) — un adjunto PDF por proforma, no un PDF
// combinado. Replica exactamente la lógica del endpoint individual
// (POST /api/proformas/[id]/enviar-cliente) para: chequeo de rol, estado
// requerido, resolución del email del cliente, generación del PDF con
// generarPDFProforma, creación del token de aprobación por proforma
// (tokens_aprobacion_cliente) y el paso a estado 'enviada' + evento.
//
// Si las proformas seleccionadas son de clientes distintos, se agrupan por
// cliente_id y se manda UN correo por cliente (nunca se mezclan
// destinatarios de clientes distintos en un mismo correo).
//
// Errores parciales: una proforma que no está en estado 'aprobada', que no
// tiene cliente con email, o que falla al generar su PDF/token, se excluye
// del envío y se reporta en `errores` — no tumba el envío de las demás
// proformas válidas (del mismo cliente o de otros clientes).
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', session.user.id).single()
  if (!usuario || !['operaciones', 'admin'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'No autorizado para enviar proformas al cliente' }, { status: 403 })
  }

  const body = await req.json()
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === 'string') : []
  // Override manual de destinatario — solo tiene sentido cuando todas las
  // proformas resultan ser del mismo cliente (si hay varios clientes en el
  // lote, se ignora para no mandarle a un cliente el correo de otro).
  const destinatarioOverride: string | undefined = typeof body.destinatario === 'string' && body.destinatario.trim()
    ? body.destinatario.trim()
    : undefined

  if (ids.length === 0) return NextResponse.json({ error: 'ids requerido (array no vacío)' }, { status: 400 })

  const adminClient = createAdminClient()

  const { data: proformas, error: fetchError } = await adminClient
    .from('proformas')
    .select(`*, cliente:clientes(*), parametros_precio:parametros_precio(*), lineas:proforma_lineas(*)`)
    .in('id', ids)
    .order('orden', { referencedTable: 'proforma_lineas', ascending: true })

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  const errores: ErrorItem[] = []
  const encontradasIds = new Set((proformas || []).map(p => p.id))
  for (const id of ids) {
    if (!encontradasIds.has(id)) errores.push({ id, error: 'Proforma no encontrada' })
  }

  // Validación defensiva (la UI ya solo deja seleccionar 'aprobada', pero el
  // endpoint no confía en eso) — mismo requisito que el endpoint individual.
  const validas: Proforma[] = []
  for (const p of (proformas || []) as Proforma[]) {
    if (p.estado !== 'aprobada') {
      errores.push({ id: p.id, numero: p.numero, error: `Estado '${p.estado}', solo se pueden enviar proformas aprobadas` })
      continue
    }
    if (!p.cliente?.contacto_email && !destinatarioOverride) {
      errores.push({ id: p.id, numero: p.numero, error: 'El cliente no tiene email registrado' })
      continue
    }
    validas.push(p)
  }

  // Agrupar por cliente — un correo por cliente, nunca se mezclan destinatarios.
  const grupos = new Map<string, Proforma[]>()
  for (const p of validas) {
    const key = p.cliente_id
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(p)
  }

  const destinatarioUnico = grupos.size === 1 ? destinatarioOverride : undefined
  const enviadas: { id: string; numero: string }[] = []

  for (const proformasCliente of Array.from(grupos.values())) {
    const items: { proforma: Proforma; pdfBuffer: Buffer; tokenAprobacion: string }[] = []

    for (const proforma of proformasCliente) {
      try {
        const pdfBuffer = await generarPDFProforma(proforma)

        const { data: tokenAprobacion } = await adminClient
          .from('tokens_aprobacion_cliente')
          .insert({ proforma_id: proforma.id })
          .select('token')
          .single()

        if (!tokenAprobacion) {
          errores.push({ id: proforma.id, numero: proforma.numero, error: 'No se pudo generar el link de aprobación' })
          continue
        }

        items.push({ proforma, pdfBuffer, tokenAprobacion: tokenAprobacion.token })
      } catch (e) {
        errores.push({ id: proforma.id, numero: proforma.numero, error: e instanceof Error ? e.message : 'Error al generar el PDF' })
      }
    }

    if (items.length === 0) continue

    try {
      if (destinatarioUnico) {
        // Override manual de destinatario (solo aplica cuando todo el lote es
        // de un único cliente): se sobreescribe el email en cada item antes de enviar.
        await enviarProformasCliente(items.map(it => ({
          ...it,
          proforma: { ...it.proforma, cliente: { ...it.proforma.cliente!, contacto_email: destinatarioUnico } },
        })))
      } else {
        await enviarProformasCliente(items)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al enviar el correo'
      for (const it of items) errores.push({ id: it.proforma.id, numero: it.proforma.numero, error: msg })
      continue
    }

    const idsEnviados = items.map(it => it.proforma.id)
    const fecha = new Date().toISOString().split('T')[0]

    await adminClient
      .from('proformas')
      .update({
        estado: 'enviada',
        fecha_envio_cliente: fecha,
        updated_at: new Date().toISOString(),
      })
      .in('id', idsEnviados)

    await adminClient.from('proforma_eventos').insert(
      items.map(it => ({
        proforma_id: it.proforma.id,
        usuario_id: session.user.id,
        estado_desde: 'aprobada',
        estado_hacia: 'enviada',
        comentario: `PDF enviado a ${destinatarioUnico || it.proforma.cliente?.contacto_email} (envío en lote)`,
      }))
    )

    for (const it of items) enviadas.push({ id: it.proforma.id, numero: it.proforma.numero })
  }

  const status = enviadas.length > 0 ? 200 : 400
  return NextResponse.json({ ok: enviadas.length > 0, enviadas, errores }, { status })
}
