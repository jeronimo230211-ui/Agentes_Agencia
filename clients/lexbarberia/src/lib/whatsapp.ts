import type { WhatsAppProvider } from "@/types/scheduling"

type ProviderCfg = Record<string, string>

/** Opción que el cliente puede tocar en vez de escribir. */
export interface ReplyOption {
  id: string // "A", "B", "C"…
  title: string
  description?: string
}

export interface AgentReply {
  text: string
  options?: ReplyOption[]
}

// Límites de mensajes interactivos de WhatsApp Cloud API.
const MAX_BUTTONS = 3
const MAX_BUTTON_TITLE = 20
const MAX_LIST_ROWS = 10
const MAX_ROW_TITLE = 24
const MAX_ROW_DESCRIPTION = 72

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

/** Versión en texto plano de una respuesta con opciones ("A. Corte"). Se usa
 *  para proveedores sin mensajes interactivos, para el endpoint de prueba y
 *  para guardar en el historial — así el agente sabe qué opciones ofreció y
 *  entiende si el cliente responde solo "A". */
export function renderReplyAsText(reply: AgentReply): string {
  if (!reply.options?.length) return reply.text
  const lines = reply.options.map((o) => `${o.id}. ${o.title}${o.description ? ` (${o.description})` : ""}`)
  return `${reply.text}\n\n${lines.join("\n")}`
}

/** Envía la respuesta del agente: con opciones tocables (botones hasta 3,
 *  lista hasta 10) si el proveedor es Meta, o como texto en cualquier otro
 *  caso. Si Meta rechaza el interactivo, cae a texto — el cliente nunca se
 *  queda sin respuesta. */
export async function sendAgentReply(provider: WhatsAppProvider, cfg: ProviderCfg, to: string, reply: AgentReply): Promise<void> {
  const options = reply.options ?? []
  if (provider === "meta" && options.length > 0 && options.length <= MAX_LIST_ROWS) {
    try {
      await sendMetaInteractive(cfg, to, reply.text, options)
      return
    } catch (err) {
      console.error("[sendAgentReply] Interactivo falló, se envía como texto:", err)
    }
  }
  await sendWhatsAppMessage(provider, cfg, to, renderReplyAsText(reply))
}

async function sendMetaInteractive(cfg: ProviderCfg, to: string, body: string, options: ReplyOption[]) {
  const useButtons = options.length <= MAX_BUTTONS && options.every((o) => o.title.length <= MAX_BUTTON_TITLE && !o.description)

  const interactive = useButtons
    ? {
        type: "button",
        body: { text: body },
        action: { buttons: options.map((o) => ({ type: "reply", reply: { id: o.id, title: o.title } })) },
      }
    : {
        type: "list",
        body: { text: body },
        action: {
          button: "Ver opciones",
          sections: [
            {
              rows: options.map((o) => {
                // Si el título no cabe, el texto completo pasa a la descripción para no perder información.
                const cut = o.title.length > MAX_ROW_TITLE
                const description = [cut ? o.title : null, o.description].filter(Boolean).join(" · ")
                return {
                  id: o.id,
                  title: truncate(o.title, MAX_ROW_TITLE),
                  ...(description ? { description: truncate(description, MAX_ROW_DESCRIPTION) } : {}),
                }
              }),
            },
          ],
        },
      }

  const res = await fetch(`https://graph.facebook.com/v19.0/${cfg.phone_number_id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.access_token}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "interactive", interactive }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Meta interactive error ${res.status}: ${JSON.stringify(err)}`)
  }
}

export async function sendWhatsAppMessage(
  provider: WhatsAppProvider,
  cfg: ProviderCfg,
  to: string,
  body: string
): Promise<void> {
  try {
    if (provider === "360dialog") await send360Dialog(cfg, to, body)
    else if (provider === "meta") await sendMeta(cfg, to, body)
    else if (provider === "twilio") await sendTwilio(cfg, to, body)
  } catch (err) {
    // No tumbar el request por un fallo de envío — la cita ya quedó
    // guardada en la base de datos independientemente del mensaje.
    console.error("[sendWhatsAppMessage] Error:", err)
  }
}

async function send360Dialog(cfg: ProviderCfg, to: string, body: string) {
  await fetch("https://waba.360dialog.io/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "D360-API-KEY": cfg.api_token,
    },
    body: JSON.stringify({ to, type: "text", text: { body } }),
  })
}

async function sendMeta(cfg: ProviderCfg, to: string, body: string) {
  const res = await fetch(`https://graph.facebook.com/v19.0/${cfg.phone_number_id}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.access_token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error("[sendMeta] Error:", JSON.stringify(err))
    throw new Error(`Meta API error ${res.status}`)
  }
}

async function sendTwilio(cfg: ProviderCfg, to: string, body: string) {
  const credentials = Buffer.from(`${cfg.account_sid}:${cfg.auth_token}`).toString("base64")
  const params = new URLSearchParams({
    From: cfg.from_number,
    To: `whatsapp:${to}`,
    Body: body,
  })
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.account_sid}/Messages.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: params.toString(),
  })
}

/** Envía una plantilla aprobada por Meta. Es la única forma de escribirle
 *  primero a un cliente si pasaron más de 24h desde su último mensaje (ej. el
 *  recordatorio de cita). A diferencia de sendWhatsAppMessage, lanza el error:
 *  quien llama necesita saber si se envió para registrarlo. */
export async function sendMetaTemplate(
  cfg: ProviderCfg,
  to: string,
  template: { name: string; language: string; bodyParams: string[]; buttonPayloads?: string[] }
): Promise<void> {
  const components: Record<string, unknown>[] = [
    { type: "body", parameters: template.bodyParams.map((text) => ({ type: "text", text })) },
    ...(template.buttonPayloads ?? []).map((payload, index) => ({
      type: "button",
      sub_type: "quick_reply",
      index: String(index),
      parameters: [{ type: "payload", payload }],
    })),
  ]

  const res = await fetch(`https://graph.facebook.com/v19.0/${cfg.phone_number_id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.access_token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: template.name, language: { code: template.language }, components },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Meta template error ${res.status}: ${JSON.stringify(err)}`)
  }
}

/** Descarga un archivo de audio de WhatsApp (Meta Cloud API) usando el
 *  mismo access_token del negocio. Meta requiere dos pasos: primero pedir
 *  la URL temporal del archivo, luego descargarlo con el mismo token. */
export async function downloadMetaMedia(mediaId: string, accessToken: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!metaRes.ok) return null
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string }
    if (!meta.url) return null

    const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!fileRes.ok) return null
    const arrayBuffer = await fileRes.arrayBuffer()
    return { buffer: Buffer.from(arrayBuffer), mimeType: meta.mime_type || "audio/ogg" }
  } catch (err) {
    console.error("[downloadMetaMedia] Error:", err)
    return null
  }
}

// ─── Webhook parsing ──────────────────────────────────────────────────────

export type ParsedMessage =
  | {
      kind: "text"
      from: string
      body: string
      messageId?: string
      /** Nombre del perfil de WhatsApp del cliente (puede ser un apodo). */
      profileName?: string
      /** Payload del botón de una plantilla (ej. "rem:no:<id de la cita>"). */
      buttonPayload?: string
    }
  | {
      kind: "audio"
      from: string
      mediaId: string
      messageId?: string
    }
  | {
      /** Imagen, video, documento, ubicación o contacto: no se procesan, pero el
       *  cliente recibe un aviso en vez de silencio. */
      kind: "unsupported"
      from: string
      messageId?: string
    }

export function parse360Dialog(payload: Record<string, unknown>): ParsedMessage | null {
  const messages =
    (payload.messages as { id?: string; from: string; type: string; text?: { body: string }; audio?: { id: string } }[]) || []
  const msg = messages.find((m) => m.type === "text" || m.type === "audio")
  if (!msg) return null
  if (msg.type === "audio" && msg.audio?.id) return { kind: "audio", from: msg.from, mediaId: msg.audio.id, messageId: msg.id }
  if (msg.type === "text" && msg.text?.body) return { kind: "text", from: msg.from, body: msg.text.body, messageId: msg.id }
  return null
}

const SUPPORTED_META_TYPES = ["text", "audio", "interactive", "button"]
const UNSUPPORTED_META_TYPES = ["image", "video", "document", "location", "contacts"]

interface MetaMessage {
  id?: string
  from: string
  type: string
  text?: { body: string }
  audio?: { id: string }
  interactive?: {
    type: "button_reply" | "list_reply"
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string; description?: string }
  }
  button?: { text: string; payload?: string }
}

export function parseMeta(payload: Record<string, unknown>): ParsedMessage | null {
  try {
    const entry = (
      payload.entry as {
        changes: { value: { messages?: MetaMessage[]; contacts?: { wa_id?: string; profile?: { name?: string } }[] } }[]
      }[]
    )?.[0]
    const value = entry?.changes?.[0]?.value
    // Reacciones y stickers se ignoran a propósito (suelen ser un "👍" de cierre:
    // responderles sería ruido). Los demás tipos sin soporte reciben un aviso.
    const msg = value?.messages?.find((m) => [...SUPPORTED_META_TYPES, ...UNSUPPORTED_META_TYPES].includes(m.type))
    if (!msg) return null
    if (UNSUPPORTED_META_TYPES.includes(msg.type)) return { kind: "unsupported", from: msg.from, messageId: msg.id }
    const profileName = value?.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name || value?.contacts?.[0]?.profile?.name
    if (msg.type === "audio" && msg.audio?.id) return { kind: "audio", from: msg.from, mediaId: msg.audio.id, messageId: msg.id }
    if (msg.type === "text" && msg.text?.body) return { kind: "text", from: msg.from, body: msg.text.body, messageId: msg.id, profileName }
    if (msg.type === "interactive") {
      // El cliente tocó un botón o una fila de lista: se le pasa al agente el
      // texto de la opción (con la descripción, que puede traer la fecha completa).
      const choice = msg.interactive?.button_reply || msg.interactive?.list_reply
      if (!choice) return null
      const description = msg.interactive?.list_reply?.description
      const body = description ? `${choice.title} (${description})` : choice.title
      return { kind: "text", from: msg.from, body, messageId: msg.id, profileName }
    }
    if (msg.type === "button" && msg.button?.text) {
      // Botón de respuesta rápida de una PLANTILLA (ej. el recordatorio de cita):
      // llega con tipo "button" y un payload que pusimos al enviarla.
      return { kind: "text", from: msg.from, body: msg.button.text, messageId: msg.id, profileName, buttonPayload: msg.button.payload }
    }
    return null
  } catch {
    return null
  }
}

export function parseTwilio(body: string): ParsedMessage | null {
  try {
    const params = new URLSearchParams(body)
    const from = params.get("From")?.replace("whatsapp:", "") || ""
    const messageId = params.get("MessageSid") || undefined
    if (!from) return null

    const numMedia = Number(params.get("NumMedia") || "0")
    const mediaUrl = params.get("MediaUrl0")
    const mediaType = params.get("MediaContentType0") || ""
    if (numMedia > 0 && mediaUrl && mediaType.startsWith("audio/")) {
      // Twilio no usa mediaId — el mismo MediaUrl0 sirve para descargar directo.
      return { kind: "audio", from, mediaId: mediaUrl, messageId }
    }

    const text = params.get("Body") || ""
    if (!text) return null
    return { kind: "text", from, body: text, messageId }
  } catch {
    return null
  }
}
