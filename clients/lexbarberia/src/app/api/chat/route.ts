import { NextRequest, NextResponse } from "next/server"
import { AUTH_COOKIE_NAME, expectedSessionValue } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase"
import { runAgent } from "@/lib/agent"
import { renderReplyAsText } from "@/lib/whatsapp"
import type { Barber, Business, ChatMessage, Conversation, Service } from "@/types/scheduling"

// Endpoint de prueba interna: simula una conversación de WhatsApp sin
// necesitar un proveedor conectado. Útil mientras se gestiona el alta de
// 360Dialog (Fase 5). No exponer públicamente sin autenticación.
//
// POST { phone: string, message: string, profileName?: string } → { reply: string, options?: [...] }

export async function POST(request: NextRequest) {
  // Este endpoint actúa como CUALQUIER teléfono que se le pase: abierto en
  // producción, cualquiera podría agendar o cancelar citas de otros clientes y
  // gastar el saldo de Claude. En producción exige la sesión del dashboard.
  if (process.env.NODE_ENV === "production" && request.cookies.get(AUTH_COOKIE_NAME)?.value !== expectedSessionValue()) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const phone = body?.phone as string | undefined
  const message = body?.message as string | undefined
  const profileName = (body?.profileName as string | undefined) || null

  if (!phone || !message) {
    return NextResponse.json({ error: "Faltan 'phone' y/o 'message'" }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: business } = await db.from("business").select("*").eq("active", true).single()
  if (!business) return NextResponse.json({ error: "Negocio no configurado" }, { status: 404 })

  const { data: barber } = await db.from("barbers").select("*").eq("business_id", business.id).eq("active", true).order("created_at").limit(1).single()
  if (!barber) return NextResponse.json({ error: "Barbero no configurado" }, { status: 404 })

  const { data: services } = await db.from("services").select("*").eq("business_id", business.id).eq("active", true).order("sort_order")

  const { data: existingConversation } = await db
    .from("conversations")
    .select("*")
    .eq("business_id", business.id)
    .eq("client_phone", phone)
    .single()

  const history: ChatMessage[] = (existingConversation as Conversation | null)?.messages || []

  const reply = await runAgent(
    { db, business: business as Business, barber: barber as Barber, services: (services || []) as Service[], clientPhone: phone, profileName },
    history,
    message
  )

  const now = new Date().toISOString()
  const newHistory: ChatMessage[] = [
    ...history,
    { role: "user", content: message, ts: now },
    { role: "assistant", content: renderReplyAsText(reply), ts: now },
  ]

  if (existingConversation) {
    await db.from("conversations").update({ messages: newHistory }).eq("id", existingConversation.id)
  } else {
    await db.from("conversations").insert({ business_id: business.id, client_phone: phone, messages: newHistory })
  }

  return NextResponse.json({ reply: renderReplyAsText(reply), options: reply.options ?? null })
}
