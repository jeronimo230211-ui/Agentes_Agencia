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

  const envToken = process.env.WEBHOOK_VERIFY_TOKEN
  if (envToken && token === envToken) {
    return new Response(challenge, { status: 200 })
  }

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

  // ── Parse provider ────────────────────────────────────────────────────────────
  if (contentType.includes("application/json") && !request.headers.get("x-twilio-signature")) {
    let payload: Record<string, unknown>
    try { payload = await request.json() } catch { return new Response("OK", { status: 200 }) }

    if (payload.object === "whatsapp_business_account") {
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

  // ── Load gym ──────────────────────────────────────────────────────────────────
  const { data: gym } = await db.from("gyms").select("*").eq("id", gymId).single()
  if (!gym) return new Response("OK", { status: 200 })

  // ── Load or create conversation ───────────────────────────────────────────────
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

  // ── Capture lead (person-first) ───────────────────────────────────────────────
  if (!leadCaptured && shouldCaptureLead(userText, history)) {
    leadCaptured = true
    const name = extractName(userText, history)
    const interest = detectInterest(newHistory)

    // 1. Find or create person by WhatsApp number
    const personId = await upsertPerson(db, gymId, fromNumber, name)

    // 2. Get default pipeline + first stage
    const { data: pipeline } = await db
      .from("lead_pipelines")
      .select("id, lead_pipeline_stages(id, sort_order)")
      .eq("gym_id", gymId)
      .eq("is_default", true)
      .single()

    const stages = (pipeline?.lead_pipeline_stages as { id: string; sort_order: number }[] | null) || []
    stages.sort((a, b) => a.sort_order - b.sort_order)
    const firstStageId = stages[0]?.id || null

    // 3. Create lead
    const { data: lead } = await db.from("leads").insert({
      gym_id: gymId,
      name,
      phone: fromNumber,
      interest,
      person_id: personId,
      pipeline_id: pipeline?.id || null,
      stage_id: firstStageId,
      status: "open",
      last_activity_at: now,
    }).select("id").single()

    // 4. Log the full conversation as a WhatsApp activity
    if (lead) {
      await db.from("activities").insert({
        gym_id: gymId,
        lead_id: lead.id,
        person_id: personId,
        type: "whatsapp",
        title: "Conversación inicial WhatsApp",
        comment: userText,
        additional: { messages: newHistory },
        is_done: true,
      })
    }

    // 5. Notify via Make.com
    const makeUrl = process.env.MAKE_WEBHOOK_URL
    if (makeUrl) {
      await fetch(makeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gym: gym.name,
          lead_name: name,
          lead_phone: fromNumber,
          interest,
          stage: "Prospecto",
        }),
      }).catch(() => {})
    }
  } else if (leadCaptured && existing) {
    // Update activity log for ongoing conversations of known leads
    const { data: existingLead } = await db
      .from("leads")
      .select("id")
      .eq("gym_id", gymId)
      .eq("phone", fromNumber)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (existingLead) {
      await db.from("leads")
        .update({ last_activity_at: now })
        .eq("id", existingLead.id)
    }
  }

  // ── Save conversation ─────────────────────────────────────────────────────────
  if (existing) {
    await db.from("conversations")
      .update({ messages: newHistory, lead_captured: leadCaptured })
      .eq("id", existing.id)
  } else {
    await db.from("conversations")
      .insert({ gym_id: gymId, from_number: fromNumber, messages: newHistory, lead_captured: leadCaptured })
  }

  await sendWhatsAppMessage(gym.provider, gym.provider_config, fromNumber, reply)

  if (request.headers.get("x-twilio-signature")) {
    return new Response("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    })
  }

  return new Response("OK", { status: 200 })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function upsertPerson(
  db: ReturnType<typeof createServiceClient>,
  gymId: string,
  phone: string,
  name: string | null
): Promise<string | null> {
  const whatsappEntry = [{ value: phone, label: "whatsapp" }]

  // Try to find existing person by WhatsApp number
  const { data: existing } = await db
    .from("persons")
    .select("id, name")
    .eq("gym_id", gymId)
    .contains("contact_numbers", whatsappEntry)
    .single()

  if (existing) {
    // Update name if we now know it and didn't before
    if (name && !existing.name) {
      await db.from("persons").update({ name, updated_at: new Date().toISOString() }).eq("id", existing.id)
    }
    return existing.id
  }

  // Create new person
  const { data: created } = await db.from("persons").insert({
    gym_id: gymId,
    name,
    contact_numbers: whatsappEntry,
  }).select("id").single()

  return created?.id || null
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
  const hasPhone = /\d{7,}/.test(allText)
  const hasNamePrefix = ["soy ", "me llamo ", "mi nombre es "].some((p) => allText.includes(p))
  const botAskedName = history.some(
    (m) => m.role === "assistant" && (m.content.includes("nombre") || m.content.includes("teléfono") || m.content.includes("telefono"))
  )
  const hasName = hasNamePrefix || (botAskedName && hasPhone)
  return hasInterest && hasName
}

function extractName(userText: string, history: Message[]): string | null {
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
  const botAskIdx = history.findLastIndex(
    (m) => m.role === "assistant" && (m.content.includes("nombre") || m.content.includes("teléfono"))
  )
  if (botAskIdx !== -1) {
    const firstLine = userText.split("\n")[0].trim()
    if (firstLine.length > 2 && !/^\d+$/.test(firstLine)) return firstLine
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
