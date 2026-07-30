import { Resend } from 'resend'
import type { Proforma } from '@/types/europartners'
import { formatUSD } from './precio'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const FROM = process.env.EMAIL_FROM || 'Europartners <onboarding@resend.dev>'

const resend = new Resend(process.env.RESEND_API_KEY)

async function enviarEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: { filename: string; content: string }[]
): Promise<void> {
  const { error } = await resend.emails.send({ from: FROM, to, subject, html, attachments })
  if (error) throw new Error(error.message)
}

export async function enviarNotificacionAprobacion(
  proforma: Proforma,
  token: string,
  destinatarioEmail: string,
  comentarioCliente?: string
): Promise<void> {
  const total = proforma.total_cif_usd || proforma.total_fob_usd || 0
  const clienteNombre = proforma.cliente?.nombre || 'Cliente'
  const lineas = proforma.lineas || []
  const approveUrl = `${APP_URL}/aprobacion-token/${token}`

  const tablaLineas = lineas.slice(0, 8).map(l =>
    `<tr>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${l.codigo_pdf || ''}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${l.descripcion_pdf}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center">${l.cantidad}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${formatUSD(l.precio_cliente_usd || 0)}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;color:${(l.margen_pct || 0) < 0.10 ? '#dc2626' : '#16a34a'}">${((l.margen_pct || 0) * 100).toFixed(1)}%</td>
    </tr>`
  ).join('')

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1E3A5F;padding:20px;text-align:center">
        <h1 style="color:#D4A017;margin:0;font-size:20px">Europartners</h1>
        <p style="color:white;margin:4px 0 0;font-size:13px">Sistema de Operaciones</p>
      </div>
      <div style="padding:24px;background:#f9fafb">
        <h2 style="color:#1E3A5F;margin:0 0 8px">Proforma lista para revisión</h2>
        <p style="color:#6b7280;margin:0 0 20px">
          Deisy preparó la proforma <strong>${proforma.numero}</strong> para
          <strong>${clienteNombre}</strong>.
        </p>
        ${comentarioCliente ? `
        <div style="background:#fffbeb;border-left:4px solid #D4A017;border-radius:4px;padding:14px 16px;margin-bottom:20px">
          <p style="color:#92400e;margin:0 0 4px;font-size:12px;font-weight:bold;text-transform:uppercase">El cliente pidió este cambio</p>
          <p style="color:#1E3A5F;margin:0;font-size:14px">${comentarioCliente}</p>
        </div>` : ''}
        <div style="background:white;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;margin-bottom:20px">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#1E3A5F;color:white">
                <th style="padding:8px;text-align:left">Código</th>
                <th style="padding:8px;text-align:left">Descripción</th>
                <th style="padding:8px;text-align:center">Qty</th>
                <th style="padding:8px;text-align:right">Precio</th>
                <th style="padding:8px;text-align:right">Margen</th>
              </tr>
            </thead>
            <tbody>${tablaLineas}</tbody>
            <tfoot>
              <tr style="background:#f9fafb;font-weight:bold">
                <td colspan="3" style="padding:8px">TOTAL ${proforma.incoterm}</td>
                <td colspan="2" style="padding:8px;text-align:right;color:#1E3A5F">${formatUSD(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="${approveUrl}"
             style="background:#16a34a;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
            ✓ APROBAR PROFORMA
          </a>
        </div>
        <div style="text-align:center">
          <a href="${APP_URL}/aprobacion" style="color:#6b7280;font-size:13px;text-decoration:underline">Ver en el sistema</a>
          &nbsp;·&nbsp;
          <a href="${approveUrl}?accion=rechazar" style="color:#dc2626;font-size:13px;text-decoration:underline">Rechazar</a>
        </div>
        <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:24px">Este enlace expira en 7 días.</p>
      </div>
    </div>
  `

  await enviarEmail(destinatarioEmail, `[REVISAR] Proforma ${proforma.numero} · ${clienteNombre} · ${formatUSD(total)}`, html)
}

export async function enviarNotificacionComprobante(
  numeroProforma: string,
  clienteNombre: string,
  monto: number | null,
  proformaId: string,
  destinatarioEmail: string
): Promise<void> {
  const verUrl = `${APP_URL}/cotizador/${proformaId}`

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1E3A5F;padding:20px;text-align:center">
        <h1 style="color:#D4A017;margin:0;font-size:20px">Europartners</h1>
        <p style="color:white;margin:4px 0 0;font-size:13px">Sistema de Operaciones</p>
      </div>
      <div style="padding:24px;background:#f9fafb">
        <h2 style="color:#1E3A5F;margin:0 0 8px">Comprobante de pago recibido</h2>
        <p style="color:#6b7280;margin:0 0 12px">
          <strong>${clienteNombre}</strong> subió el comprobante de pago de la proforma
          <strong>${numeroProforma}</strong>.
        </p>
        <p style="color:#6b7280;margin:0 0 20px">
          Monto declarado: <strong style="color:#1E3A5F">${monto != null ? formatUSD(monto) : 'No especificado por el cliente'}</strong>
        </p>
        <div style="text-align:center;margin:24px 0">
          <a href="${verUrl}"
             style="background:#1E3A5F;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block">
            Revisar y confirmar pago
          </a>
        </div>
      </div>
    </div>
  `

  await enviarEmail(destinatarioEmail, `Comprobante de pago — Proforma ${numeroProforma}`, html)
}

export async function enviarNotificacionSolicitudNueva(
  clienteNombre: string,
  numLineas: number,
  destinatarioEmail: string
): Promise<void> {
  const solicitudesUrl = `${APP_URL}/solicitudes`

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1E3A5F;padding:20px;text-align:center">
        <h1 style="color:#D4A017;margin:0;font-size:20px">Europartners</h1>
        <p style="color:white;margin:4px 0 0;font-size:13px">Sistema de Operaciones</p>
      </div>
      <div style="padding:24px;background:#f9fafb">
        <h2 style="color:#1E3A5F;margin:0 0 8px">Nueva solicitud de pedido</h2>
        <p style="color:#6b7280;margin:0 0 20px">
          <strong>${clienteNombre}</strong> envió una solicitud nueva con
          ${numLineas} línea${numLineas !== 1 ? 's' : ''}.
        </p>
        <div style="text-align:center;margin:24px 0">
          <a href="${solicitudesUrl}"
             style="background:#1E3A5F;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block">
            Ver solicitud
          </a>
        </div>
      </div>
    </div>
  `

  await enviarEmail(destinatarioEmail, `Nueva solicitud de ${clienteNombre}`, html)
}

interface ProformaResumen {
  numero: string
  // Supabase infiere el join como objeto o arreglo según cómo se escriba el
  // select() — se acepta cualquiera de los dos y se normaliza abajo.
  cliente?: { nombre?: string } | { nombre?: string }[] | null
}

export async function enviarNotificacionResultado(
  proforma: ProformaResumen,
  resultado: 'aprobada' | 'rechazada',
  destinatarioEmail: string,
  motivo?: string
): Promise<void> {
  const clienteObj = Array.isArray(proforma.cliente) ? proforma.cliente[0] : proforma.cliente
  const clienteNombre = clienteObj?.nombre || 'Cliente'
  const esAprobada = resultado === 'aprobada'
  const color = esAprobada ? '#16a34a' : '#dc2626'
  const etiqueta = esAprobada ? 'APROBADA' : 'RECHAZADA'

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1E3A5F;padding:20px;text-align:center">
        <h1 style="color:#D4A017;margin:0;font-size:20px">Europartners</h1>
      </div>
      <div style="padding:24px;background:#f9fafb">
        <h2 style="color:${color};margin:0 0 8px">Proforma ${etiqueta}</h2>
        <p style="color:#6b7280;margin:0 0 12px">
          La proforma <strong>${proforma.numero}</strong> para <strong>${clienteNombre}</strong>
          fue ${resultado} por Marta.
        </p>
        ${motivo ? `<p style="color:#6b7280"><strong>Motivo:</strong> ${motivo}</p>` : ''}
        <div style="text-align:center;margin:20px 0">
          <a href="${APP_URL}/proformas" style="color:#1E3A5F;font-size:13px;text-decoration:underline">Ver en el sistema</a>
        </div>
      </div>
    </div>
  `

  await enviarEmail(destinatarioEmail, `[${etiqueta}] Proforma ${proforma.numero} · ${clienteNombre}`, html)
}

export async function enviarSolicitudDevuelta(
  clienteEmail: string,
  clienteNombre: string,
  motivo: string,
  tokenEdicion: string
): Promise<void> {
  const editarUrl = `${APP_URL}/solicitud-editar/${tokenEdicion}`

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1E3A5F;padding:20px;text-align:center">
        <h1 style="color:#D4A017;margin:0;font-size:20px">Europartners</h1>
      </div>
      <div style="padding:24px;background:#f9fafb">
        <h2 style="color:#1E3A5F;margin:0 0 8px">Necesitamos confirmar algo de tu pedido</h2>
        <p style="color:#6b7280;margin:0 0 16px">Hola ${clienteNombre},</p>
        <p style="color:#6b7280;margin:0 0 16px">
          Antes de preparar tu proforma, revisamos tu pedido y necesitamos que confirmes o ajustes lo siguiente:
        </p>
        <div style="background:white;border-left:4px solid #D4A017;border-radius:4px;padding:14px 16px;margin-bottom:20px">
          <p style="color:#1E3A5F;margin:0;font-size:14px">${motivo}</p>
        </div>
        <p style="color:#6b7280;margin:0 0 20px">
          Puedes revisar y editar tu pedido directamente desde el siguiente enlace:
        </p>
        <div style="text-align:center;margin:24px 0">
          <a href="${editarUrl}"
             style="background:#D4A017;color:#1E3A5F;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block">
            Revisar mi pedido
          </a>
        </div>
        <p style="color:#9ca3af;font-size:12px;text-align:center">Este enlace es de un solo uso.</p>
      </div>
    </div>
  `

  await enviarEmail(clienteEmail, `Europartners necesita confirmar tu pedido`, html)
}

export async function enviarProformaParaAprobacion(
  proforma: Proforma,
  pdfBuffer: Buffer,
  tokenAprobacion: string
): Promise<void> {
  const clienteEmail = proforma.cliente?.contacto_email
  if (!clienteEmail) throw new Error('Cliente sin email de contacto')

  const clienteNombre = proforma.cliente?.contacto_nombre || proforma.cliente?.nombre || 'Cliente'
  const total = proforma.total_cif_usd || proforma.total_fob_usd || 0
  const aprobacionUrl = `${APP_URL}/aprobacion-cliente/${tokenAprobacion}`

  const { error } = await resend.emails.send({
    from: FROM,
    to: clienteEmail,
    subject: `Proforma ${proforma.numero} — Please Review — Europartners International`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1E3A5F;padding:20px">
          <h1 style="color:#D4A017;margin:0;font-size:20px">Europartners International</h1>
        </div>
        <div style="padding:24px">
          <p>Dear ${clienteNombre},</p>
          <p>Please find attached our proforma invoice <strong>${proforma.numero}</strong> for your review.</p>
          <p><strong>Total ${proforma.incoterm}: ${formatUSD(total)}</strong></p>
          <p>Please review it and let us know if you approve it or need any changes before we issue the final invoice.</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${aprobacionUrl}"
               style="background:#D4A017;color:#1E3A5F;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block">
              Review &amp; Approve Proforma
            </a>
          </div>
          <p>This proforma is valid for 15 days from the date of issue.</p>
          <p>Best regards,<br><strong>Deisy</strong><br>Europartners International<br>Panama City, Panama</p>
        </div>
      </div>
    `,
    attachments: [{
      filename: `Proforma-${proforma.numero}.pdf`,
      content: pdfBuffer.toString('base64'),
    }],
  })

  if (error) throw new Error(error.message)
}

export async function enviarProformaCliente(
  proforma: Proforma,
  pdfBuffer: Buffer,
  pagoToken?: string,
  esInvoice?: boolean
): Promise<void> {
  const clienteEmail = proforma.cliente?.contacto_email
  if (!clienteEmail) throw new Error('Cliente sin email de contacto')

  const clienteNombre = proforma.cliente?.contacto_nombre || proforma.cliente?.nombre || 'Cliente'
  const total = proforma.total_cif_usd || proforma.total_fob_usd || 0
  const pagoUrl = pagoToken ? `${APP_URL}/pago/${pagoToken}` : null
  const label = esInvoice ? 'Invoice' : 'Proforma Invoice'

  const { error } = await resend.emails.send({
    from: FROM,
    to: clienteEmail,
    subject: `${label} ${proforma.numero} — Europartners International`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1E3A5F;padding:20px">
          <h1 style="color:#D4A017;margin:0;font-size:20px">Europartners International</h1>
        </div>
        <div style="padding:24px">
          <p>Dear ${clienteNombre},</p>
          ${esInvoice
            ? `<p>Thank you for approving proforma <strong>${proforma.numero}</strong>. Please find attached your final invoice.</p>`
            : `<p>Please find attached our proforma invoice <strong>${proforma.numero}</strong> for your review.</p>`
          }
          <p><strong>Total ${proforma.incoterm}: ${formatUSD(total)}</strong></p>
          ${esInvoice ? '' : '<p>This proforma is valid for 15 days from the date of issue.</p>'}
          ${pagoUrl ? `
          <div style="text-align:center;margin:24px 0">
            <a href="${pagoUrl}"
               style="background:#D4A017;color:#1E3A5F;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block">
              Upload payment proof
            </a>
          </div>` : ''}
          <p>Best regards,<br><strong>Deisy</strong><br>Europartners International<br>Panama City, Panama</p>
        </div>
      </div>
    `,
    attachments: [{
      filename: `${label.replace(' ', '-')}-${proforma.numero}.pdf`,
      // Resend espera el adjunto en base64 (nodemailer aceptaba el Buffer crudo)
      content: pdfBuffer.toString('base64'),
    }],
  })

  if (error) throw new Error(error.message)
}
