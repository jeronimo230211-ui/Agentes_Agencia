import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase"
import { checkWaitlistForBarber } from "@/lib/booking-service"
import type { Business } from "@/types/scheduling"

async function getContext(db: ReturnType<typeof createServiceClient>) {
  const { data: business } = await db.from("business").select("*").eq("active", true).single()
  if (!business) return null
  const { data: barber } = await db.from("barbers").select("*").eq("business_id", business.id).eq("active", true).order("created_at").limit(1).single()
  if (!barber) return null
  return { business: business as Business, barber }
}

export async function GET() {
  const db = createServiceClient()
  const ctx = await getContext(db)
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const { data: hours } = await db.from("business_hours").select("*").eq("barber_id", ctx.barber.id).order("day_of_week")
  return NextResponse.json({ hours: hours || [] })
}

// body: { days: [{ day_of_week: 0-6, ranges: [{start,end}] }] } — un array de hasta 7 entradas.
// ranges: [] significa día cerrado.
export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!Array.isArray(body?.days)) return NextResponse.json({ error: "Falta 'days'" }, { status: 400 })

  const db = createServiceClient()
  const ctx = await getContext(db)
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const rows = body.days.map((d: { day_of_week: number; ranges: { start: string; end: string }[] }) => ({
    barber_id: ctx.barber.id,
    day_of_week: d.day_of_week,
    ranges: d.ranges,
  }))

  const { error } = await db.from("business_hours").upsert(rows, { onConflict: "barber_id,day_of_week" })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // El cambio pudo abrir un horario que alguien estaba esperando.
  await checkWaitlistForBarber(db, ctx.business, ctx.barber)

  const { data: hours } = await db.from("business_hours").select("*").eq("barber_id", ctx.barber.id).order("day_of_week")
  return NextResponse.json({ hours: hours || [] })
}
