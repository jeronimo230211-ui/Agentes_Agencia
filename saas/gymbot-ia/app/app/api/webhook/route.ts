import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase"
import { getChatResponse } from "@/lib/claude"
import type { Message } from "@/lib/supabase"

type DialogMessage = {
  from: string
  id: string
  text?: { body: string }
  type: string
  timestamp: string
}

type DialogPayload = {
  contacts?: { wa_id: string }[]
  messages?: DialogMessage[]
}

export async function POST(request: NextRequest) {
  let payload: DialogPayload
  try {
    payload = await request.json()
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }

  const messages = payload.messages
  if (!messages || messages.length === 0) {
    return new Response("OK", { status: 200 })
  }

  const incomingMsg = messages.find((m) => m.type === "text" && m.text?.body)
  if (!incomingMsg || !incomingMsg.text?.body) {
    return new Response("OK", { status: 200 })
  }

  const fromNumber = incomingMsg.from
  const userText = incomingMsg.text.body

  const db = createServiceClient()

  // Find gym by matching whatsapp_number or by webhook lookup
  // 360Dialog sends to the webhook URL configured per account
  // We identify the gym from the Authorization header token
  const authHeader = request.headers.get("authorization") || ""
  const token = authHeader.replace("Bearer ", "").trim()

  let gymId: string | null = null

  if (token) {
    const { data: gym } = await db
      .from("gyms")
      .select("id, name, config, api_token")
      .eq("api_token", token)
      .eq("active", true)
      .single()

    if (gym) gymId = gym.id
  }

  if (!gymId) {
    return new Response("OK", { status: 200 })
  }

  const { data: gym } = await db
    .from("gyms")
    .select("*")
    .eq("id", gymId)
    .single()

  if (!gym) return new Response("OK", { status: 200 })

  // Fetch or create conversation
  const { data: existing } = await db
    .from("conversations")
    .select("*")
    .eq("gym_id", gymId)
    .eq("from_number", fromNumber)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  const history: Message[] = existing?.messages || []

  // Detect lead capture in previous messages
  let leadCaptured = existing?.lead_captured || false

  // Get Claude response
  const reply = await getChatResponse(
    gym.name,
    gym.config,
    history.map((m) => ({ role: m.role, content: m.content })),
    userText
  )

  // Update history
  const now = new Date().toISOString()
  const newHistory: Message[] = [
    ...history,
    { role: "user", content: userText, ts: now },
    { role: "assistant", content: reply, ts: now },
  ]

  // Detect lead capture: if user shared their name, check for it
  if (!leadCaptured && shouldCaptureLead(userText, history)) {
    leadCaptured = true
    const name = extractName(userText, history)
    const phone = fromNumber

    await db.from("leads").insert({
      gym_id: gymId,
      name,
      phone,
      interest: detectInterest(newHistory),
    })

    // Notify via Make.com if configured
    const makeUrl = process.env.MAKE_WEBHOOK_URL
    if (makeUrl) {
      await fetch(makeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gym: gym.name,
          lead_name: name,
          lead_phone: phone,
          interest: detectInterest(newHistory),
        }),
      }).catch(() => {})
    }
  }

  // Save/update conversation
  if (existing) {
    await db
      .from("conversations")
      .update({ messages: newHistory, lead_captured: leadCaptured })
      .eq("id", existing.id)
  } else {
    await db.from("conversations").insert({
      gym_id: gymId,
      from_number: fromNumber,
      messages: newHistory,
      lead_captured: leadCaptured,
    })
  }

  // Send reply via 360Dialog
  if (gym.api_token) {
    await send360Message(gym.api_token, fromNumber, reply)
  }

  return new Response("OK", { status: 200 })
}

async function send360Message(apiToken: string, to: string, body: string) {
  try {
    await fetch("https://waba.360dialog.io/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "D360-API-KEY": apiToken,
      },
      body: JSON.stringify({
        to,
        type: "text",
        text: { body },
      }),
    })
  } catch {
    // Log but don't fail — message saved in DB
  }
}

function shouldCaptureLead(userText: string, history: Message[]): boolean {
  const text = userText.toLowerCase()
  const allText = [...history.map((m) => m.content), userText].join(" ").toLowerCase()

  const nameIndicators = ["soy ", "me llamo ", "mi nombre es "]
  const hasNameIndicator = nameIndicators.some((ind) => allText.includes(ind))

  const interestIndicators = ["inscribir", "membresia", "membresía", "precio", "clase", "horario"]
  const hasInterest = interestIndicators.some((ind) => text.includes(ind))

  return hasNameIndicator && hasInterest
}

function extractName(userText: string, history: Message[]): string | null {
  const allTexts = [...history.map((m) => m.content), userText]
  for (const text of allTexts) {
    const lower = text.toLowerCase()
    for (const prefix of ["soy ", "me llamo ", "mi nombre es "]) {
      const idx = lower.indexOf(prefix)
      if (idx !== -1) {
        const name = text.slice(idx + prefix.length).split(/[\s,!.]/)[0]
        if (name.length > 1) return name
      }
    }
  }
  return null
}

function detectInterest(history: Message[]): string {
  const allText = history.map((m) => m.content).join(" ").toLowerCase()
  if (allText.includes("clase") || allText.includes("spinning") || allText.includes("yoga"))
    return "Clases"
  if (allText.includes("inscribir") || allText.includes("membresia") || allText.includes("membresía"))
    return "Membresía"
  if (allText.includes("precio") || allText.includes("costo") || allText.includes("vale"))
    return "Precios"
  return "General"
}
