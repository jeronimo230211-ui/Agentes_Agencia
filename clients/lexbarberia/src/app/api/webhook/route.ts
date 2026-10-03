import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase"
import { runAgent } from "@/lib/agent"
import { handleReminderButton } from "@/lib/reminders"
import { parse360Dialog, parseMeta, parseTwilio, renderReplyAsText, sendAgentReply, sendWhatsAppMessage, type AgentReply, type ParsedMessage } from "@/lib/whatsapp"
import type { Barber, Business, ChatMessage, Conversation, Service } from "@/types/scheduling"

// LexBarbería es de un solo negocio (no multi-tenant como GymBot IA), así
// que el webhook no necesita resolver "a qué cliente pertenece este
// mensaje" — siempre es el mismo negocio. Si esto se productiza para
// varios negocios más adelante, aquí es donde se agregaría ese lookup.

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

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || ""

  let parsed: ParsedMessage | null

  if (contentType.includes("application/json") && !request.headers.get("x-twilio-signature")) {
    let payload: Record<string, unknown>
    try {
      payload = await request.json()
    } catch {
      return new Response("OK", { status: 200 })
    }
    parsed = payload.object === "whatsapp_business_account" ? parseMeta(payload) : parse360Dialog(payload)
  } else {
    parsed = parseTwilio(await request.text())
  }

  if (!parsed?.from) return new Response("OK", { status: 200 })
  const fromNumber = parsed.from
  const messageId = parsed.messageId

  const db = createServiceClient()

  // WhatsApp/Meta reintenta la entrega si no respondemos rápido, lo que puede
  // hacer que el mismo mensaje llegue dos veces — sin esto, el agente
  // respondería duplicado y podría hasta agendar dos veces la misma cita.
  if (messageId) {
    const { error: insertError } = await db.from("processed_webhook_messages").insert({ id: messageId })
    if (insertError) {
      // 23505 = ya existe (mensaje duplicado, reintento de Meta) — se descarta en silencio.
      if (insertError.code === "23505") return new Response("OK", { status: 200 })
      // Si la tabla todavía no existe (migración pendiente) u otro error, seguimos
      // procesando igual — mejor un duplicado ocasional que dejar de responder.
    }
  }

  const { data: business } = await db.from("business").select("*").eq("active", true).single()
  if (!business) return new Response("OK", { status: 200 })

  // Las notas de voz todavía no se transcriben (propuesta pendiente con Alex) —
  // antes el cliente quedaba sin respuesta; al menos se le pide que escriba.
  if (parsed.kind === "audio") {
    if (business.whatsapp_provider) {
      await sendWhatsAppMessage(
        business.whatsapp_provider,
        business.whatsapp_provider_config,
        fromNumber,
        "Por ahora no puedo escuchar notas de voz 🙏 ¿Me lo escribe por aquí, porfa?"
      )
    }
    return new Response("OK", { status: 200 })
  }
  const userText = parsed.body

  const { data: barber } = await db.from("barbers").select("*").eq("business_id", business.id).eq("active", true).order("created_at").limit(1).single()
  if (!barber) return new Response("OK", { status: 200 })

  const { data: services } = await db.from("services").select("*").eq("business_id", business.id).eq("active", true).order("sort_order")

  const { data: existingConversation } = await db
    .from("conversations")
    .select("*")
    .eq("business_id", business.id)
    .eq("client_phone", fromNumber)
    .single()

  const history: ChatMessage[] = (existingConversation as Conversation | null)?.messages || []

  // Botones del recordatorio automático: se resuelven con lógica fija, sin el modelo.
  const reminderReply = parsed.buttonPayload
    ? await handleReminderButton(db, business as Business, barber as Barber, fromNumber, parsed.buttonPayload)
    : null

  let reply: AgentReply
  try {
    reply = reminderReply
      ? { text: reminderReply }
      : await runAgent(
          {
            db,
            business: business as Business,
            barber: barber as Barber,
            services: (services || []) as Service[],
            clientPhone: fromNumber,
            profileName: parsed.profileName,
          },
          history,
          userText
        )
  } catch (err) {
    // Si el agente falla (ej. la cuenta de Anthropic sin saldo, 2026-10-03), el
    // cliente quedaba en silencio total: el ID del mensaje ya estaba marcado como
    // procesado, así que los reintentos de Meta se descartaban. Ahora al menos
    // recibe una respuesta honesta.
    console.error("[webhook] El agente falló:", err)
    reply = { text: "Disculpe, en este momento no puedo responder por un problema técnico 🙏 Por favor intente de nuevo en un rato." }
  }

  const now = new Date().toISOString()
  const newHistory: ChatMessage[] = [
    ...history,
    { role: "user", content: userText, ts: now },
    { role: "assistant", content: renderReplyAsText(reply), ts: now },
  ]

  if (existingConversation) {
    await db.from("conversations").update({ messages: newHistory }).eq("id", existingConversation.id)
  } else {
    await db.from("conversations").insert({ business_id: business.id, client_phone: fromNumber, messages: newHistory })
  }

  if (business.whatsapp_provider) {
    await sendAgentReply(business.whatsapp_provider, business.whatsapp_provider_config, fromNumber, reply)
  }

  if (request.headers.get("x-twilio-signature")) {
    return new Response("<Response></Response>", { status: 200, headers: { "Content-Type": "text/xml" } })
  }

  return new Response("OK", { status: 200 })
}
