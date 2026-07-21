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
  destinatarioEmail: string
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

export async function enviarProformaCliente(
  proforma: Proforma,
  pdfBuffer: Buffer,
  pagoToken?: string
): Promise<void> {
  const clienteEmail = proforma.cliente?.contacto_email
  if (!clienteEmail) throw new Error('Cliente sin email de contacto')

  const clienteNombre = proforma.cliente?.nombre || 'Cliente'
  const total = proforma.total_cif_usd || proforma.total_fob_usd || 0
  const pagoUrl = pagoToken ? `${APP_URL}/pago/${pagoToken}` : null

  const { error } = await resend.emails.send({
    from: FROM,
    to: clienteEmail,
    subject: `Proforma Invoice ${proforma.numero} — Europartners International`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1E3A5F;padding:20px">
          <h1 style="color:#D4A017;margin:0;font-size:20px">Europartners International</h1>
        </div>
        <div style="padding:24px">
          <p>Dear ${clienteNombre},</p>
          <p>Please find attached our proforma invoice <strong>${proforma.numero}</strong> for your review.</p>
          <p><strong>Total ${proforma.incoterm}: ${formatUSD(total)}</strong></p>
          <p>This proforma is valid for 15 days from the date of issue.</p>
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
      filename: `Proforma-${proforma.numero}.pdf`,
      // Resend espera el adjunto en base64 (nodemailer aceptaba el Buffer crudo)
      content: pdfBuffer.toString('base64'),
    }],
  })

  if (error) throw new Error(error.message)
}
