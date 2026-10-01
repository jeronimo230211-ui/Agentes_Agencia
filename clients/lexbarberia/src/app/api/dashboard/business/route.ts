import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase"

export async function GET() {
  const db = createServiceClient()
  const { data: business } = await db.from("business").select("*").eq("active", true).single()
  if (!business) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const { data: barber } = await db.from("barbers").select("*").eq("business_id", business.id).eq("active", true).order("created_at").limit(1).single()

  // Nunca mandar tokens al navegador: el dashboard solo necesita saber si hay conexión.
  const safeBusiness = {
    ...business,
    whatsapp_provider_config: {},
    google_calendar_tokens: business.google_calendar_tokens?.refresh_token ? { refresh_token: "connected" } : null,
  }
  return NextResponse.json({ business: safeBusiness, barber })
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.id) return NextResponse.json({ error: "Falta id" }, { status: 400 })

  const db = createServiceClient()
  const updates: Record<string, unknown> = {}
  for (const key of ["address", "greeting", "cancellation_window_hours", "buffer_minutes", "reminder_hours_before"]) {
    if (body[key] !== undefined) updates[key] = body[key]
  }
  if (body.disconnect_google) updates.google_calendar_tokens = null

  const { data, error } = await db.from("business").update(updates).eq("id", body.id).select("*").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: Boolean(data) })
}
