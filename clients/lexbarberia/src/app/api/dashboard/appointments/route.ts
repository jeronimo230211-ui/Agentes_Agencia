import { NextRequest, NextResponse } from "next/server"
import { fromZonedTime } from "date-fns-tz"
import { createServiceClient } from "@/lib/supabase"
import { bookAppointment, checkWaitlistForBarber, createRecurringBooking, findOrCreateClient } from "@/lib/booking-service"
import { removeAppointmentFromCalendar, syncAppointmentToCalendar } from "@/lib/google-calendar"
import type { Business, Service } from "@/types/scheduling"

async function getContext(db: ReturnType<typeof createServiceClient>) {
  const { data: business } = await db.from("business").select("*").eq("active", true).single()
  if (!business) return null
  const { data: barber } = await db.from("barbers").select("*").eq("business_id", business.id).eq("active", true).order("created_at").limit(1).single()
  if (!barber) return null
  return { business: business as Business, barber }
}

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD — citas en el rango (por defecto, hoy en adelante 14 días)
export async function GET(request: NextRequest) {
  const db = createServiceClient()
  const ctx = await getContext(db)
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from") || new Date().toISOString().slice(0, 10)
  const to = searchParams.get("to") || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)

  const { data: appointments } = await db
    .from("appointments")
    .select("*, clients(name, phone), services(name, duration_minutes)")
    .eq("business_id", ctx.business.id)
    .eq("barber_id", ctx.barber.id)
    .in("status", ["confirmed", "pending_reschedule", "completed", "no_show"])
    .gte("starts_at", `${from}T00:00:00Z`)
    .lt("starts_at", `${to}T23:59:59Z`)
    .order("starts_at", { ascending: true })

  return NextResponse.json({ appointments: appointments || [] })
}

// body single: { mode: "single", serviceId, clientPhone, clientName, startsAt (ISO) }
// body recurring: { mode: "recurring", serviceId, clientPhone, clientName, dayOfWeek, startTime, weeksAhead? }
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.serviceId || !body?.clientPhone) {
    return NextResponse.json({ error: "Faltan 'serviceId' y/o 'clientPhone'" }, { status: 400 })
  }

  const db = createServiceClient()
  const ctx = await getContext(db)
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const { data: service } = await db.from("services").select("*").eq("id", body.serviceId).single()
  if (!service) return NextResponse.json({ error: "servicio_no_encontrado" }, { status: 404 })

  const client = await findOrCreateClient(db, ctx.business.id, body.clientPhone, body.clientName || null)

  if (body.mode === "recurring") {
    if (body.dayOfWeek === undefined || !body.startTime) {
      return NextResponse.json({ error: "Faltan 'dayOfWeek' y/o 'startTime'" }, { status: 400 })
    }
    const result = await createRecurringBooking(db, {
      businessId: ctx.business.id,
      barberId: ctx.barber.id,
      service: service as Service,
      clientId: client.id,
      dayOfWeek: body.dayOfWeek,
      startTime: body.startTime,
      timezone: ctx.business.timezone,
      weeksAhead: body.weeksAhead,
      onBooked: (appointment) => syncAppointmentToCalendar(db, ctx.business, ctx.barber, appointment, service as Service, client),
    })
    return NextResponse.json({ recurring: result })
  }

  if (!body.startsAt) return NextResponse.json({ error: "Falta 'startsAt'" }, { status: 400 })

  // startsAt llega como "YYYY-MM-DDTHH:mm" (hora de pared, del <input type="datetime-local">
  // del dashboard) — se interpreta en la zona horaria del negocio, no en UTC ni en la del browser.
  const startsAt = fromZonedTime(`${body.startsAt}:00`, ctx.business.timezone)

  const result = await bookAppointment(db, {
    businessId: ctx.business.id,
    barberId: ctx.barber.id,
    service: service as Service,
    clientId: client.id,
    startsAt,
    source: "dashboard",
  })

  if (!result.ok) return NextResponse.json({ error: "horario_ya_tomado" }, { status: 409 })

  await syncAppointmentToCalendar(db, ctx.business, ctx.barber, result.appointment, service as Service, client)

  return NextResponse.json({ appointment: result.appointment })
}

// body: { id, status: "cancelled" | "completed" | "no_show" }
export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.id || !body?.status) return NextResponse.json({ error: "Faltan 'id' y/o 'status'" }, { status: 400 })

  const db = createServiceClient()
  const updates: Record<string, unknown> = { status: body.status }
  if (body.status === "cancelled") {
    updates.cancelled_at = new Date().toISOString()
    updates.cancelled_reason = body.reason || "Cancelada por el barbero"
  }

  const { data: appointment, error } = await db.from("appointments").update(updates).eq("id", body.id).select("*, clients(id, no_show_count)").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.status === "no_show" && appointment?.clients) {
    await db.from("clients").update({ no_show_count: appointment.clients.no_show_count + 1 }).eq("id", appointment.clients.id)
  }

  if (body.status === "cancelled" && appointment) {
    const ctx = await getContext(db)
    if (ctx) {
      await removeAppointmentFromCalendar(db, ctx.business, ctx.barber, appointment)
      await checkWaitlistForBarber(db, ctx.business, ctx.barber) // se liberó un cupo
    }
  }

  return NextResponse.json({ appointment })
}
