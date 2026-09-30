import { NextRequest, NextResponse } from "next/server"
import { addDays } from "date-fns"
import { fromZonedTime } from "date-fns-tz"
import { createServiceClient } from "@/lib/supabase"
import { broadcastNovelty } from "@/lib/booking-service"
import type { Business } from "@/types/scheduling"

// body: { rangeStart: "YYYY-MM-DD", rangeEnd: "YYYY-MM-DD", message: string }
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.rangeStart || !body?.rangeEnd || !body?.message) {
    return NextResponse.json({ error: "Faltan 'rangeStart', 'rangeEnd' y/o 'message'" }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: business } = await db.from("business").select("*").eq("active", true).single()
  if (!business) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const { data: barber } = await db.from("barbers").select("id").eq("business_id", business.id).eq("active", true).order("created_at").limit(1).single()
  if (!barber) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const b = business as Business
  const rangeStart = fromZonedTime(`${body.rangeStart}T00:00:00`, b.timezone)
  const rangeEnd = addDays(fromZonedTime(`${body.rangeEnd}T00:00:00`, b.timezone), 1) // fin de día inclusive

  const result = await broadcastNovelty(db, {
    business: b,
    barberId: barber.id,
    message: body.message,
    rangeStart,
    rangeEnd,
  })

  return NextResponse.json(result)
}
