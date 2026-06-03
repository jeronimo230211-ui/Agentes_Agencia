import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase"
import { getChatResponse } from "@/lib/claude"
import { sendWhatsAppMessage, parse360Dialog, parseMeta, parseTwilio } from "@/lib/whatsapp"
import type { Message } from "@/lib/supabase"

// Meta requires GET for webhook verification
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode !== "subscribe" || !token || !challenge) {
    return new Response("Bad request", { status: 400 })
  }

  // Accept global verify token from env var (simpler, no DB lookup needed)
  const envToken = process.env.WEBHOOK_VERIFY_TOKEN
  if (envToken && token === envToken) {
    return new Response(challenge, { status: 200 })
  }

  // Fallback: find gym with matching verify_token in provider_config
  const db = createServiceClient()
  const { data: gym } = await db
    .from("gyms")
    .select("id")
    .eq("provider", "meta")
    .contains("provider_config", { verify_token: token })
    .single()

  if (!gym) return new Response("Forbidden", { status: 403 })
  return new Response(challenge, { status: 200 })
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || ""
  const db = createServiceClient()

  let fromNumber: string | null = null
  let userText: string | null = null
  let gymId: string | null = null

  // ── 360Dialog ────────────────────────────────────────────────────────────────
  if (contentType.includes("application/json") && !request.headers.get("x-twilio-signature")) {
    let payload: Record<string, unknown>
    try { payload = await request.json() } catch { return new Response("OK", { status: 200 }) }

    // Detect Meta vs 360Dialog by payload shape
    if (payload.object === "whatsapp_business_account") {
      // Meta Cloud API
      const parsed = parseMeta(payload)
      if (!parsed) return new Response("OK", { status: 200 })
      fromNumber = parsed.from
      userText = parsed.body

      const { data: gym } = await db
        .from("gyms")
        .select("id")
        .eq("provider", "meta")
        .contains("provider_config", { phone_number_id: parsed.providerId })
        .eq("active", true)
        .single()
      if (gym) gymId = gym.id
    } else {
      // 360Dialog
      const parsed = parse360Dialog(payload)
      if (!parsed) return new Response("OK", { status: 200 })
      fromNumber = parsed.from
      userText = parsed.body

      const authHeader = request.headers.get("authorization") || ""
      const token = authHeader.replace("Bearer ", "").trim()
      if (token) {
        const { data: gym } = await db
          .from("gyms")
          .select("id")
          .eq("provider", "360dialog")
          .contains("provider_config", { api_token: token })
          .eq("active", true)
          .single()
        if (gym) gymId = gym.id
      }
      // Fallback: match by api_token legacy field
      if (!gymId) {
        const { data: gym } = await db
          .from("gyms")
          .select("id")
          .eq("provider", "360dialog")
          .eq("api_token", token)
          .eq("active", true)
          .single()
        if (gym) gymId = gym.id
      }
    }
  } else {
    // Twilio (form-encoded)
    const body = await request.text()
    const parsed = parseTwilio(body)
    if (!parsed) return new Response("OK", { status: 200 })
    fromNumber = parsed.from
    userText = parsed.body

    const { data: gym } = await db
      .from("gyms")
      .select("id")
      .eq("provider", "twilio")
      .contains("provider_config", { from_number: `whatsapp:${parsed.providerId}` })
      .eq("active", true)
      .single()
    if (gym) gymId = gym.id
  }

  if (!gymId || !fromNumber || !userText) return new Response("OK", { status: 200 })

  // ── Process with Claude ───────────────────────────────────────────────────────
  const { data: gym } = await db.from("gyms").select("*").eq("id", gymId).single()
  if (!gym) return new Response("OK", { status: 200 })

  const { data: existing } = await db
    .from("conversations")
    .select("*")
    .eq("gym_id", gymId)
    .eq("from_number", fromNumber)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  const history: Message[] = existing?.messages || []
  let leadCaptured = existing?.lead_captured || false

  const reply = await getChatResponse(
    gym.name,
    gym.config,
    history.map((m) => ({ role: m.role, content: m.content })),
    userText
  )

  const now = new Date().toISOString()
  const newHistory: Message[] = [
    ...history,
    { role: "user", content: userText, ts: now },
    { role: "assistant", content: reply, ts: now },
  ]

  if (!leadCaptured && shouldCaptureLead(userText, history)) {
    leadCaptured = true
    const name = extractName(userText, history)
    await db.from("leads").insert({
      gym_id: gymId,
      name,
      phone: fromNumber,
      interest: detectInterest(newHistory),
    })
    const makeUrl = process.env.MAKE_WEBHOOK_URL
    if (makeUrl) {
      await fetch(makeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gym: gym.name, lead_name: name, lead_phone: fromNumber, interest: detectInterest(newHistory) }),
      }).catch(() => {})
    }
  }

  if (existing) {
    await db.from("conversations").update({ messages: newHistory, lead_captured: leadCaptured }).eq("id", existing.id)
  } else {
    await db.from("conversations").insert({ gym_id: gymId, from_number: fromNumber, messages: newHistory, lead_captured: leadCaptured })
  }

  await sendWhatsAppMessage(gym.provider, gym.provider_config, fromNumber, reply)

  // Twilio expects TwiML response
  if (request.headers.get("x-twilio-signature")) {
    return new Response("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    })
  }

  return new Response("OK", { status: 200 })
}

function shouldCaptureLead(userText: string, history: Message[]): boolean {
  const allText = [...history.map((m) => m.content), userText].join(" ").toLowerCase()
  const interestKeywords = [
    "inscribir", "inscripción", "inscripcion",
    "membresía", "membresia", "mensualidad", "mensual",
    "trimestral", "semestral", "anual",
    "precio", "costo", "cuánto", "cuanto",
    "quiero", "interesa", "me apunto", "clase",
  ]
  const hasInterest = interestKeywords.some((p) => allText.includes(p))
  // Has phone number pattern in conversation
  const hasPhone = /\d{7,}/.test(allText)
  // Has name prefix OR the bot asked for name and got a multi-word response
  const hasNamePrefix = ["soy ", "me llamo ", "mi nombre es "].some((p) => allText.includes(p))
  const botAskedName = history.some(
    (m) => m.role === "assistant" && (m.content.includes("nombre") || m.content.includes("teléfono") || m.content.includes("telefono"))
  )
  const hasName = hasNamePrefix || (botAskedName && hasPhone)
  return hasInterest && hasName
}

function extractName(userText: string, history: Message[]): string | null {
  // Only check USER messages for name prefixes (not bot messages)
  const userMessages = history.filter((m) => m.role === "user").map((m) => m.content)
  for (const text of [...userMessages, userText]) {
    for (const prefix of ["soy ", "me llamo ", "mi nombre es "]) {
      const idx = text.toLowerCase().indexOf(prefix)
      if (idx !== -1) {
        const name = text.slice(idx + prefix.length).split(/[\s,!.]/)[0]
        if (name.length > 1) return name
      }
    }
  }
  // Fallback: bot asked for name → current userText or next user message is the name
  const botAskIdx = history.findLastIndex(
    (m) => m.role === "assistant" && (m.content.includes("nombre") || m.content.includes("teléfono"))
  )
  if (botAskIdx !== -1) {
    // Check if userText (current message) is the name response
    const firstLine = userText.split("\n")[0].trim()
    if (firstLine.length > 2 && !/^\d+$/.test(firstLine)) return firstLine
    // Otherwise check next user message in history
    const nextUserMsg = history.slice(botAskIdx + 1).find((m) => m.role === "user")
    if (nextUserMsg) {
      const line = nextUserMsg.content.split("\n")[0].trim()
      if (line.length > 2 && !/^\d+$/.test(line)) return line
    }
  }
  return null
}

function detectInterest(history: Message[]): string {
  const all = history.map((m) => m.content).join(" ").toLowerCase()
  if (all.includes("clase") || all.includes("spinning") || all.includes("yoga")) return "Clases"
  if (all.includes("inscribir") || all.includes("membresía") || all.includes("membresia")) return "Membresía"
  if (all.includes("precio") || all.includes("costo")) return "Precios"
  return "General"
}
