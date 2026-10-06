// Cola de mensajes entrantes por cliente. Resuelve dos problemas reales:
//
// 1. Concurrencia: los clientes de WhatsApp mandan varios mensajes cortos
//    seguidos ("Hola" + "¿tienes cita a las 6?"). Antes, cada uno disparaba
//    una invocación en paralelo que leía el mismo historial, respondía por su
//    lado y al guardar pisaba el historial de la otra (y podía agendar doble).
// 2. Mínimos mensajes: los mensajes que llegan con pocos segundos de diferencia
//    se responden juntos, con UNA sola respuesta.
//
// Cómo: cada mensaje se guarda en inbound_messages; se espera DEBOUNCE_MS por
// si llegan más; luego un único proceso por teléfono (candado con vencimiento
// en conversations.processing_until) responde todo lo pendiente, en orden.

import type { createServiceClient } from "./supabase"
import { runAgent } from "./agent"
import { handleReminderButton } from "./reminders"
import { renderReplyAsText, sendAgentReply, type AgentReply } from "./whatsapp"
import type { Barber, Business, ChatMessage, Service } from "@/types/scheduling"

type Db = ReturnType<typeof createServiceClient>

const DEBOUNCE_MS = 2500
/** Si un proceso se cae con el candado tomado, se libera solo pasado este tiempo. */
const LOCK_SECONDS = 90
const MAX_ROUNDS = 4
/** El historial guardado se recorta para que la fila no crezca sin límite. */
const MAX_STORED_MESSAGES = 200

const AGENT_ERROR_REPLY = "Disculpe, en este momento no puedo responder por un problema técnico 🙏 Por favor intente de nuevo en un rato."

interface InboundRow {
  id: string
  body: string
  profile_name: string | null
  button_payload: string | null
  received_at: string
}

export async function enqueueInbound(
  db: Db,
  msg: { id: string; businessId: string; phone: string; body: string; profileName?: string | null; buttonPayload?: string | null }
): Promise<"queued" | "duplicate"> {
  const { error } = await db.from("inbound_messages").insert({
    id: msg.id,
    business_id: msg.businessId,
    client_phone: msg.phone,
    body: msg.body,
    profile_name: msg.profileName ?? null,
    button_payload: msg.buttonPayload ?? null,
  })
  if (error) {
    if (error.code === "23505") return "duplicate" // reintento de Meta con el mismo wamid
    throw new Error(`No se pudo encolar el mensaje: ${error.message}`)
  }
  return "queued"
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function pendingFor(db: Db, businessId: string, phone: string): Promise<InboundRow[]> {
  const { data } = await db
    .from("inbound_messages")
    .select("id, body, profile_name, button_payload, received_at")
    .eq("business_id", businessId)
    .eq("client_phone", phone)
    .is("processed_at", null)
    .order("received_at", { ascending: true })
  return (data || []) as InboundRow[]
}

/** Toma el candado del teléfono de forma atómica (UPDATE condicional). */
async function claimLock(db: Db, businessId: string, phone: string): Promise<boolean> {
  await db
    .from("conversations")
    .upsert({ business_id: businessId, client_phone: phone, messages: [] }, { onConflict: "business_id,client_phone", ignoreDuplicates: true })

  const now = new Date()
  const { data } = await db
    .from("conversations")
    .update({ processing_until: new Date(now.getTime() + LOCK_SECONDS * 1000).toISOString() })
    .eq("business_id", businessId)
    .eq("client_phone", phone)
    .or(`processing_until.is.null,processing_until.lt.${now.toISOString()}`)
    .select("id")
  return Boolean(data && data.length > 0)
}

async function releaseLock(db: Db, businessId: string, phone: string) {
  await db.from("conversations").update({ processing_until: null }).eq("business_id", businessId).eq("client_phone", phone)
}

/** Agrega mensajes al historial. Seguro porque solo se llama con el candado tomado. */
async function appendHistory(db: Db, businessId: string, phone: string, entries: ChatMessage[]): Promise<ChatMessage[]> {
  const { data } = await db.from("conversations").select("messages").eq("business_id", businessId).eq("client_phone", phone).single()
  const messages = [...(((data?.messages as ChatMessage[]) || [])), ...entries].slice(-MAX_STORED_MESSAGES)
  await db.from("conversations").update({ messages }).eq("business_id", businessId).eq("client_phone", phone)
  return messages
}

async function readHistory(db: Db, businessId: string, phone: string): Promise<ChatMessage[]> {
  const { data } = await db.from("conversations").select("messages").eq("business_id", businessId).eq("client_phone", phone).single()
  return (data?.messages as ChatMessage[]) || []
}

/** Procesa todo lo pendiente de un teléfono. Se llama después de responder 200 a Meta. */
export async function processInbound(db: Db, phone: string, triggeredBy: string): Promise<void> {
  await sleep(DEBOUNCE_MS)

  const { data: business } = await db.from("business").select("*").eq("active", true).single()
  if (!business) return

  // Si durante la espera llegó otro mensaje más nuevo de este cliente, esa
  // invocación los responde todos juntos — esta no hace nada.
  const pending = await pendingFor(db, business.id, phone)
  const newest = pending[pending.length - 1]
  if (newest && newest.id !== triggeredBy) return

  const { data: barber } = await db.from("barbers").select("*").eq("business_id", business.id).eq("active", true).order("created_at").limit(1).single()
  if (!barber) return
  const { data: services } = await db.from("services").select("*").eq("business_id", business.id).eq("active", true).order("sort_order")

  // Bucle externo: si otro mensaje llegó justo cuando se soltaba el candado,
  // nadie más lo tomaría — por eso se vuelve a revisar después de liberar.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!(await claimLock(db, business.id, phone))) return // otro proceso lo está atendiendo y verá estos mensajes
    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const batch = await pendingFor(db, business.id, phone)
        if (batch.length === 0) break
        await db.from("inbound_messages").update({ processed_at: new Date().toISOString() }).in("id", batch.map((m) => m.id))
        await respond(db, business as Business, barber as Barber, (services || []) as Service[], phone, batch)
      }
    } finally {
      await releaseLock(db, business.id, phone)
    }
    if ((await pendingFor(db, business.id, phone)).length === 0) return
  }
}

async function respond(db: Db, business: Business, barber: Barber, services: Service[], phone: string, batch: InboundRow[]) {
  const send = async (reply: AgentReply) => {
    if (business.whatsapp_provider) await sendAgentReply(business.whatsapp_provider, business.whatsapp_provider_config, phone, reply)
  }

  // Botones del recordatorio automático: lógica fija, uno por uno, sin el modelo.
  const textMessages: InboundRow[] = []
  for (const m of batch) {
    const reminderText = m.button_payload ? await handleReminderButton(db, business, barber, phone, m.button_payload) : null
    if (reminderText) {
      const now = new Date().toISOString()
      await appendHistory(db, business.id, phone, [
        { role: "user", content: m.body, ts: m.received_at },
        { role: "assistant", content: reminderText, ts: now },
      ])
      await send({ text: reminderText })
    } else {
      textMessages.push(m)
    }
  }
  if (textMessages.length === 0) return

  // Varios mensajes seguidos se le pasan al agente como uno solo.
  const userText = textMessages.map((m) => m.body).join("\n")
  const profileName = [...textMessages].reverse().find((m) => m.profile_name)?.profile_name ?? null
  const history = await readHistory(db, business.id, phone)

  let reply: AgentReply
  try {
    reply = await runAgent({ db, business, barber, services, clientPhone: phone, profileName }, history, userText)
  } catch (err) {
    // Ej. cuenta de Anthropic sin saldo (2026-10-03): el cliente recibe un aviso honesto, no silencio.
    console.error("[inbound-queue] El agente falló:", err)
    reply = { text: AGENT_ERROR_REPLY }
  }

  await appendHistory(db, business.id, phone, [
    { role: "user", content: userText, ts: textMessages[0].received_at },
    { role: "assistant", content: renderReplyAsText(reply), ts: new Date().toISOString() },
  ])
  await send(reply)
}
