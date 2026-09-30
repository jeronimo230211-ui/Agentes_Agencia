import { NextRequest, NextResponse } from "next/server"
import { format } from "date-fns"
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

  const { data: exceptions } = await db
    .from("schedule_exceptions")
    .select("*")
    .eq("barber_id", ctx.barber.id)
    .gte("date", format(new Date(), "yyyy-MM-dd"))
    .order("date")

  return NextResponse.json({ exceptions: exceptions || [] })
}

// body: { dates: string[] "YYYY-MM-DD", is_closed: boolean, ranges?: [...], reason?: string }
// Permite apagar/editar varios días a la vez.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!Array.isArray(body?.dates) || body.dates.length === 0) {
    return NextResponse.json({ error: "Falta 'dates'" }, { status: 400 })
  }

  const db = createServiceClient()
  const ctx = await getContext(db)
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const rows = body.dates.map((date: string) => ({
    barber_id: ctx.barber.id,
    date,
    is_closed: body.is_closed !== false,
    ranges: body.is_closed === false ? body.ranges ?? [] : null,
    reason: body.reason ?? null,
  }))

  const { error } = await db.from("schedule_exceptions").upsert(rows, { onConflict: "barber_id,date" })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si se definió un horario especial (no un cierre), pudo abrir un cupo esperado.
  if (body.is_closed === false) await checkWaitlistForBarber(db, ctx.business, ctx.barber)

  return NextResponse.json({ ok: true, count: rows.length })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db.from("schedule_exceptions").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Borrar una excepción (ej. un día cerrado) puede reabrir el horario normal de ese día.
  const ctx = await getContext(db)
  if (ctx) await checkWaitlistForBarber(db, ctx.business, ctx.barber)

  return NextResponse.json({ ok: true })
}
