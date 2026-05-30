import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase"
import { getChatResponse } from "@/lib/claude"

export async function POST(request: NextRequest) {
  let body: { gymId?: string; message?: string; history?: { role: "user" | "assistant"; content: string }[] }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { gymId, message, history = [] } = body

  if (!gymId || !message) {
    return Response.json({ error: "gymId and message are required" }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: gym } = await db
    .from("gyms")
    .select("name, config")
    .eq("id", gymId)
    .eq("active", true)
    .single()

  if (!gym) {
    return Response.json({ error: "Gym not found" }, { status: 404 })
  }

  const reply = await getChatResponse(gym.name, gym.config, history, message)
  return Response.json({ reply })
}
