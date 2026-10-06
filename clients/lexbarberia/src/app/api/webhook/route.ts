import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import { NextRequest, after } from "next/server"
import { createServiceClient } from "@/lib/supabase"
import { enqueueInbound, processInbound } from "@/lib/inbound-queue"
import { parse360Dialog, parseMeta, parseTwilio, sendWhatsAppMessage, type ParsedMessage } from "@/lib/whatsapp"

// LexBarbería es de un solo negocio (no multi-tenant como GymBot IA), así
// que el webhook no necesita resolver "a qué cliente pertenece este
// mensaje" — siempre es el mismo negocio. Si esto se productiza para
// varios negocios más adelante, aquí es donde se agregaría ese lookup.

// El procesamiento (espera de 2,5 s + Claude + envío) corre después de responder.
export const maxDuration = 60

const AUDIO_REPLY = "Por ahora no puedo escuchar notas de voz 🙏 ¿Me lo escribe por aquí, porfa?"
const UNSUPPORTED_REPLY = "Por aquí solo puedo leer mensajes de texto 🙏 ¿Me escribe lo que necesita?"

// Meta exige verificación por GET del webhook.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode !== "subscribe" || !token || !challenge) {
    return new Response("Bad request", { status: 400 })
  }

  const db = createServiceClient()
  const { data: business } = await db.from("business").select("whatsapp_provider_config").eq("active", true).single()
  const verifyToken = (business?.whatsapp_provider_config as Record<string, string> | undefined)?.verify_token

  if (verifyToken && token === verifyToken) return new Response(challenge, { status: 200 })
  return new Response("Forbidden", { status: 403 })
}

/** Meta firma cada webhook con el App Secret (X-Hub-Signature-256). Sin esta
 *  verificación, cualquiera que conozca la URL podría hacerse pasar por un
 *  cliente (cualquier número "from") y agendar o cancelar sus citas. */
function isValidMetaSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET
  if (!secret) {
    console.warn("[webhook] META_APP_SECRET no está configurado: no se está verificando la firma de Meta")
    return true
  }
  if (!header?.startsWith("sha256=")) return false
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
  const received = header.slice("sha256=".length)
  return expected.length === received.length && timingSafeEqual(Buffer.from(expected), Buffer.from(received))
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || ""
  const isTwilio = Boolean(request.headers.get("x-twilio-signature"))
  const rawBody = await request.text()

  let parsed: ParsedMessage | null
  if (contentType.includes("application/json") && !isTwilio) {
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return new Response("OK", { status: 200 })
    }
    if (payload.object === "whatsapp_business_account") {
      if (!isValidMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
        return new Response("Invalid signature", { status: 401 })
      }
      parsed = parseMeta(payload)
    } else {
      parsed = parse360Dialog(payload)
    }
  } else {
    parsed = parseTwilio(rawBody)
  }

  const ok = () =>
    isTwilio ? new Response("<Response></Response>", { status: 200, headers: { "Content-Type": "text/xml" } }) : new Response("OK", { status: 200 })

  // Eventos de estado (entregado/leído), reacciones y stickers: nada que responder.
  if (!parsed?.from) return ok()
  const fromNumber = parsed.from

  const db = createServiceClient()
  const { data: business } = await db.from("business").select("*").eq("active", true).single()
  if (!business) return ok()

  // Audios (transcripción pendiente de aprobar con Alex) y tipos sin soporte:
  // respuesta fija en vez de silencio. Se deduplican igual que los textos.
  if (parsed.kind === "audio" || parsed.kind === "unsupported") {
    if (parsed.messageId) {
      const { error } = await db.from("processed_webhook_messages").insert({ id: parsed.messageId })
      if (error?.code === "23505") return ok()
    }
    if (business.whatsapp_provider) {
      await sendWhatsAppMessage(business.whatsapp_provider, business.whatsapp_provider_config, fromNumber, parsed.kind === "audio" ? AUDIO_REPLY : UNSUPPORTED_REPLY)
    }
    return ok()
  }

  const messageId = parsed.messageId || randomUUID()
  const status = await enqueueInbound(db, {
    id: messageId,
    businessId: business.id,
    phone: fromNumber,
    body: parsed.body,
    profileName: parsed.profileName,
    buttonPayload: parsed.buttonPayload,
  })
  if (status === "duplicate") return ok() // reintento de Meta: ya está en la cola

  // Se responde 200 de inmediato (Meta reintenta si tardamos) y el resto sigue en segundo plano.
  after(() => processInbound(db, fromNumber, messageId))
  return ok()
}
