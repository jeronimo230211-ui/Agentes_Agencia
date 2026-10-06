// Capa de negocio sobre Supabase. Envuelve el motor puro de
// src/lib/scheduling.ts con acceso real a datos. La usan tanto el
// agente de WhatsApp (src/lib/agent.ts) como, más adelante, las rutas
// del dashboard — así la regla de negocio vive en un solo lugar.

import { addDays, format } from "date-fns"
import { es } from "date-fns/locale"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"
import type { createServiceClient } from "./supabase"
import { sendWhatsAppMessage } from "./whatsapp"
import { computeAvailableSlots, generateRecurringOccurrences, getEffectiveRanges, isCancellationAllowed, type BusyInterval } from "./scheduling"
import type {
  Appointment,
  Barber,
  Business,
  BusinessHours,
  Client,
  RecurringBooking,
  ScheduleException,
  TimeRange,
  Service,
  WaitlistEntry,
} from "@/types/scheduling"

type Db = ReturnType<typeof createServiceClient>

async function getSchedulingContext(db: Db, barberId: string, timezone: string, fromDate: Date, toDate: Date) {
  const [{ data: weeklyHours }, { data: exceptions }, { data: busyRows }] = await Promise.all([
    db.from("business_hours").select("*").eq("barber_id", barberId),
    db
      .from("schedule_exceptions")
      .select("*")
      .eq("barber_id", barberId)
      .gte("date", formatInTimeZone(fromDate, timezone, "yyyy-MM-dd"))
      .lte("date", formatInTimeZone(toDate, timezone, "yyyy-MM-dd")),
    db
      .from("appointments")
      .select("starts_at, ends_at")
      .eq("barber_id", barberId)
      .eq("status", "confirmed")
      // +1 día: el motor evalúa el último día completo, no solo hasta la hora exacta de toDate
      .lt("starts_at", addDays(toDate, 1).toISOString())
      .gt("ends_at", fromDate.toISOString()),
  ])

  const busy: BusyInterval[] = (busyRows || []).map((r) => ({
    start: new Date(r.starts_at as string),
    end: new Date(r.ends_at as string),
  }))

  return {
    weeklyHours: (weeklyHours || []) as BusinessHours[],
    exceptions: (exceptions || []) as ScheduleException[],
    busy,
  }
}

export interface FindSlotsParams {
  timezone: string
  barberId: string
  service: Service
  bufferMinutes: number
  fromDate?: Date
  daysAhead?: number
  maxResults?: number
  maxResultsPerDay?: number
  /** Anticipación mínima: no ofrecer horas que empiecen antes de ahora + N
   *  horas. Es el mismo valor que limita la cancelación (Ajustes → Negocio). */
  minNoticeHours?: number
}

export async function findAvailableSlots(db: Db, params: FindSlotsParams): Promise<Date[]> {
  const fromDate = params.fromDate ?? new Date()
  const toDate = addDays(fromDate, params.daysAhead ?? 7)
  const { weeklyHours, exceptions, busy } = await getSchedulingContext(db, params.barberId, params.timezone, fromDate, toDate)
  const earliestStart = new Date(Date.now() + (params.minNoticeHours ?? 0) * 60 * 60 * 1000)

  return computeAvailableSlots({
    timezone: params.timezone,
    weeklyHours,
    exceptions,
    busy,
    durationMinutes: params.service.duration_minutes,
    bufferMinutes: params.bufferMinutes,
    fromDate,
    toDate,
    now: earliestStart,
    maxResults: params.maxResults,
    maxResultsPerDay: params.maxResultsPerDay,
  })
}

/** Rangos de atención de un día concreto ("YYYY-MM-DD"), ya resolviendo
 *  excepciones (cerrado u horario especial). Sirve para distinguir una hora
 *  "ocupada" de una "fuera de horario". */
export async function getDayRanges(db: Db, barberId: string, dateStr: string): Promise<TimeRange[]> {
  const [{ data: weeklyHours }, { data: exceptions }] = await Promise.all([
    db.from("business_hours").select("*").eq("barber_id", barberId),
    db.from("schedule_exceptions").select("*").eq("barber_id", barberId).eq("date", dateStr),
  ])
  return getEffectiveRanges(dateStr, (weeklyHours || []) as BusinessHours[], (exceptions || []) as ScheduleException[])
}

/** true si `startsAt` es un inicio realmente ofrecible para ese servicio:
 *  dentro del horario, alineado a la grilla de 30 min, sin choque con otra
 *  cita y respetando la anticipación mínima. El agente lo usa antes de
 *  agendar para no confiar ciegamente en la hora que escribió el modelo. */
export async function isSlotAvailable(
  db: Db,
  params: Omit<FindSlotsParams, "fromDate" | "daysAhead" | "maxResults" | "maxResultsPerDay"> & { startsAt: Date }
): Promise<boolean> {
  const dayStr = formatInTimeZone(params.startsAt, params.timezone, "yyyy-MM-dd")
  const slots = await findAvailableSlots(db, {
    ...params,
    fromDate: fromZonedTime(`${dayStr}T00:00:00`, params.timezone),
    daysAhead: 0,
  })
  return slots.some((s) => s.getTime() === params.startsAt.getTime())
}

/** Guarda (o corrige) el nombre del cliente — a diferencia de findOrCreateClient,
 *  sobrescribe el nombre existente, por si el cliente lo corrige. */
export async function updateClientName(db: Db, businessId: string, phone: string, name: string): Promise<Client> {
  const client = await findOrCreateClient(db, businessId, phone)
  const { data: updated } = await db.from("clients").update({ name }).eq("id", client.id).select("*").single()
  return (updated as Client) || { ...client, name }
}

export async function findOrCreateClient(db: Db, businessId: string, phone: string, name?: string | null): Promise<Client> {
  const { data: existing } = await db.from("clients").select("*").eq("business_id", businessId).eq("phone", phone).single()

  if (existing) {
    if (name && !existing.name) {
      const { data: updated } = await db
        .from("clients")
        .update({ name })
        .eq("id", existing.id)
        .select("*")
        .single()
      return (updated as Client) || (existing as Client)
    }
    return existing as Client
  }

  const { data: created, error } = await db
    .from("clients")
    .insert({ business_id: businessId, phone, name: name ?? null })
    .select("*")
    .single()

  if (error || !created) throw new Error(`No se pudo crear el cliente: ${error?.message}`)
  return created as Client
}

export type BookResult =
  | { ok: true; appointment: Appointment }
  | { ok: false; reason: "slot_taken" }

export interface BookAppointmentParams {
  businessId: string
  barberId: string
  service: Service
  clientId: string
  startsAt: Date
  source?: "whatsapp" | "dashboard" | "recurring"
}

export async function bookAppointment(db: Db, params: BookAppointmentParams): Promise<BookResult> {
  const endsAt = new Date(params.startsAt.getTime() + params.service.duration_minutes * 60_000)

  const { data, error } = await db
    .from("appointments")
    .insert({
      business_id: params.businessId,
      barber_id: params.barberId,
      service_id: params.service.id,
      client_id: params.clientId,
      starts_at: params.startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      source: params.source ?? "whatsapp",
    })
    .select("*")
    .single()

  if (error) {
    // 23P01 = exclusion_violation (constraint appointments_no_overlap):
    // alguien más tomó ese horario justo antes que nosotros.
    if (error.code === "23P01") return { ok: false, reason: "slot_taken" }
    throw new Error(`No se pudo agendar la cita: ${error.message}`)
  }

  const appointment = data as Appointment

  await db.from("notifications_log").insert({
    business_id: params.businessId,
    appointment_id: appointment.id,
    client_id: params.clientId,
    type: "confirmation",
  })

  return { ok: true, appointment }
}

export type CancelResult =
  | { ok: true; appointment: Appointment }
  | { ok: false, reason: "not_found" }
  | { ok: false; reason: "too_late"; startsAt: string; windowHours: number }

export async function cancelAppointment(
  db: Db,
  appointmentId: string,
  now: Date,
  windowHours: number,
  reason?: string
): Promise<CancelResult> {
  const { data: appointment } = await db
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .eq("status", "confirmed")
    .single()

  if (!appointment) return { ok: false, reason: "not_found" }

  const startsAt = new Date(appointment.starts_at as string)
  if (!isCancellationAllowed(startsAt, now, windowHours)) {
    return { ok: false, reason: "too_late", startsAt: appointment.starts_at as string, windowHours }
  }

  const { data: updated } = await db
    .from("appointments")
    .update({ status: "cancelled", cancelled_at: now.toISOString(), cancelled_reason: reason ?? null })
    .eq("id", appointmentId)
    .select("*")
    .single()

  return { ok: true, appointment: updated as Appointment }
}

export async function findClientByPhone(db: Db, businessId: string, phone: string): Promise<Client | null> {
  const { data } = await db.from("clients").select("*").eq("business_id", businessId).eq("phone", phone).single()
  return (data as Client) || null
}

export async function getClientUpcomingAppointments(
  db: Db,
  businessId: string,
  clientId: string
): Promise<(Appointment & { services: { name: string } | null })[]> {
  const { data } = await db
    .from("appointments")
    .select("*, services(name)")
    .eq("business_id", businessId)
    .eq("client_id", clientId)
    .eq("status", "confirmed")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })

  return (data || []) as (Appointment & { services: { name: string } | null })[]
}

/** Último servicio que este cliente agendó (excluyendo canceladas), para que
 *  el agente pueda preguntar "¿lo mismo de la última vez?" en vez de partir de cero. */
export async function getClientLastService(
  db: Db,
  businessId: string,
  phone: string
): Promise<{ clientName: string | null; lastServiceName: string } | null> {
  const { data: client } = await db.from("clients").select("id, name").eq("business_id", businessId).eq("phone", phone).single()
  if (!client) return null

  const { data: lastAppointment } = await db
    .from("appointments")
    .select("services(name)")
    .eq("client_id", client.id)
    .neq("status", "cancelled")
    .order("starts_at", { ascending: false })
    .limit(1)
    .single()

  const serviceName = (lastAppointment?.services as unknown as { name: string } | null)?.name
  if (!serviceName) return null

  return { clientName: client.name, lastServiceName: serviceName }
}

// ============================================================
// Punto 3 — cita periódica fija ("todos los viernes 2pm")
// ============================================================

export interface CreateRecurringBookingParams {
  businessId: string
  barberId: string
  service: Service
  clientId: string
  dayOfWeek: number
  startTime: string // "HH:mm"
  timezone: string
  /** Cuántas semanas hacia adelante generar de una vez. Default 8. */
  weeksAhead?: number
  /** Se llama por cada ocurrencia agendada con éxito — para sincronizar con Google Calendar sin acoplar este archivo a esa lógica. */
  onBooked?: (appointment: Appointment) => Promise<void>
}

export interface CreateRecurringBookingResult {
  recurringBooking: RecurringBooking
  created: number
  skipped: number // horarios que ya estaban ocupados por otra cita
}

export async function createRecurringBooking(db: Db, params: CreateRecurringBookingParams): Promise<CreateRecurringBookingResult> {
  const { data: recurringBooking, error } = await db
    .from("recurring_bookings")
    .insert({
      business_id: params.businessId,
      barber_id: params.barberId,
      service_id: params.service.id,
      client_id: params.clientId,
      day_of_week: params.dayOfWeek,
      start_time: params.startTime,
    })
    .select("*")
    .single()

  if (error || !recurringBooking) throw new Error(`No se pudo crear la cita recurrente: ${error?.message}`)

  const fromDate = new Date()
  const toDate = addDays(fromDate, 7 * (params.weeksAhead ?? 8))

  const { data: exceptions } = await db
    .from("schedule_exceptions")
    .select("*")
    .eq("barber_id", params.barberId)
    .gte("date", format(fromDate, "yyyy-MM-dd"))
    .lte("date", format(toDate, "yyyy-MM-dd"))

  const occurrences = generateRecurringOccurrences(
    { day_of_week: params.dayOfWeek, start_time: params.startTime },
    params.service.duration_minutes,
    params.timezone,
    fromDate,
    toDate,
    (exceptions || []) as ScheduleException[]
  )

  let created = 0
  let skipped = 0
  for (const occ of occurrences) {
    const result = await bookAppointment(db, {
      businessId: params.businessId,
      barberId: params.barberId,
      service: params.service,
      clientId: params.clientId,
      startsAt: occ.starts_at,
      source: "recurring",
    })
    if (result.ok) {
      created++
      await db.from("appointments").update({ recurring_booking_id: recurringBooking.id }).eq("id", result.appointment.id)
      if (params.onBooked) await params.onBooked(result.appointment)
    } else {
      skipped++
    }
  }

  const { data: updatedRecurringBooking } = await db
    .from("recurring_bookings")
    .update({ generated_until: format(toDate, "yyyy-MM-dd") })
    .eq("id", recurringBooking.id)
    .select("*")
    .single()

  return { recurringBooking: (updatedRecurringBooking || recurringBooking) as RecurringBooking, created, skipped }
}

// ============================================================
// Punto 6 — aviso masivo de novedad con alternativas de reprogramación
// ============================================================

export interface BroadcastNoveltyParams {
  business: Business
  barberId: string
  message: string
  rangeStart: Date
  rangeEnd: Date
}

export interface BroadcastNoveltyResult {
  affectedCount: number
  notified: { clientName: string | null; phone: string; originalTime: string }[]
}

export async function broadcastNovelty(db: Db, params: BroadcastNoveltyParams): Promise<BroadcastNoveltyResult> {
  const { business, barberId, message, rangeStart, rangeEnd } = params

  const { data: appointments } = await db
    .from("appointments")
    .select("*, clients(id, name, phone), services(id, name, duration_minutes)")
    .eq("business_id", business.id)
    .eq("barber_id", barberId)
    .eq("status", "confirmed")
    .gte("starts_at", rangeStart.toISOString())
    .lt("starts_at", rangeEnd.toISOString())
    .order("starts_at", { ascending: true })

  const affected = (appointments || []) as (Appointment & {
    clients: { id: string; name: string | null; phone: string } | null
    services: Service | null
  })[]

  const notified: BroadcastNoveltyResult["notified"] = []

  for (const appt of affected) {
    if (!appt.clients || !appt.services) continue

    const alternativas = await findAvailableSlots(db, {
      timezone: business.timezone,
      barberId,
      service: appt.services,
      bufferMinutes: business.buffer_minutes,
      minNoticeHours: business.cancellation_window_hours,
      fromDate: rangeEnd, // ofrecer alternativas después del rango afectado
      daysAhead: 10,
      maxResults: 4,
    })

    const alternativasTexto = alternativas
      .map((s) => `- ${new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: business.timezone }).format(s)}`)
      .join("\n")

    const fullMessage = `${message}\n\nTu cita del ${new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: business.timezone }).format(new Date(appt.starts_at))} quedó pendiente de reprogramar. Opciones disponibles:\n${alternativasTexto}\n\nEscríbenos para confirmar cuál te sirve. 🙏`

    await db.from("appointments").update({ status: "pending_reschedule" }).eq("id", appt.id)

    if (business.whatsapp_provider) {
      await sendWhatsAppMessage(business.whatsapp_provider, business.whatsapp_provider_config, appt.clients.phone, fullMessage)
    }

    await db.from("notifications_log").insert({
      business_id: business.id,
      appointment_id: appt.id,
      client_id: appt.clients.id,
      type: "reschedule_offer",
      status: business.whatsapp_provider ? "sent" : "failed",
    })

    notified.push({
      clientName: appt.clients.name,
      phone: appt.clients.phone,
      originalTime: appt.starts_at,
    })
  }

  await db.from("broadcasts").insert({
    business_id: business.id,
    message,
    range_start: format(rangeStart, "yyyy-MM-dd"),
    // rangeEnd llega como límite exclusivo (medianoche del día siguiente al último
    // día afectado) — se resta un día para guardar la fecha que el barbero espera ver.
    range_end: format(addDays(rangeEnd, -1), "yyyy-MM-dd"),
    affected_count: notified.length,
  })

  return { affectedCount: notified.length, notified }
}

// ============================================================
// Lista de espera — el cliente pide un día específico que hoy no
// tiene cupo (o el día está cerrado); cuando Alex abre ese horario
// (cambia business_hours, borra una excepción, o se libera un cupo
// por una cancelación), se le avisa automáticamente.
// ============================================================

export async function addToWaitlist(
  db: Db,
  params: { businessId: string; barberId: string; serviceId: string; clientId: string; requestedDate: string }
): Promise<WaitlistEntry> {
  const { data, error } = await db
    .from("waitlist")
    .insert({
      business_id: params.businessId,
      barber_id: params.barberId,
      service_id: params.serviceId,
      client_id: params.clientId,
      requested_date: params.requestedDate,
    })
    .select("*")
    .single()

  if (error || !data) throw new Error(`No se pudo anotar en la lista de espera: ${error?.message}`)
  return data as WaitlistEntry
}

/** Revisa la lista de espera de un barbero y avisa a quien ya tenga cupo
 *  disponible en la fecha que pidió. Se llama después de cualquier cambio
 *  que pueda abrir un horario: editar business_hours, borrar una excepción,
 *  o cancelar una cita. Best-effort — nunca lanza. */
export async function checkWaitlistForBarber(db: Db, business: Business, barber: Barber): Promise<{ notified: number }> {
  try {
    const { data: entries } = await db
      .from("waitlist")
      .select("*, services(*), clients(name, phone)")
      .eq("barber_id", barber.id)
      .eq("status", "waiting")

    if (!entries || entries.length === 0) return { notified: 0 }

    let notified = 0

    for (const entry of entries as (WaitlistEntry & { services: Service; clients: { name: string | null; phone: string } })[]) {
      const fromDate = fromZonedTime(`${entry.requested_date}T00:00:00`, business.timezone)
      const slots = await findAvailableSlots(db, {
        timezone: business.timezone,
        barberId: barber.id,
        service: entry.services,
        bufferMinutes: business.buffer_minutes,
        minNoticeHours: business.cancellation_window_hours,
        fromDate,
        daysAhead: 0,
        maxResults: 5,
      })

      if (slots.length === 0) continue

      const horariosTexto = slots
        .map((s) => formatInTimeZone(s, business.timezone, "h:mm a", { locale: es }))
        .join(", ")
      const message = `¡Buenas noticias! Se abrió cupo para el ${formatInTimeZone(fromDate, business.timezone, "EEEE d 'de' MMMM", { locale: es })} que estabas esperando 🎉\n\nHorarios disponibles: ${horariosTexto}\n\nEscríbenos para confirmar cuál te sirve.`

      if (business.whatsapp_provider) {
        await sendWhatsAppMessage(business.whatsapp_provider, business.whatsapp_provider_config, entry.clients.phone, message)
      }

      await db.from("notifications_log").insert({
        business_id: business.id,
        client_id: entry.client_id,
        type: "waitlist_opening",
        status: business.whatsapp_provider ? "sent" : "failed",
      })

      await db.from("waitlist").update({ status: "notified", notified_at: new Date().toISOString() }).eq("id", entry.id)
      notified++
    }

    return { notified }
  } catch (err) {
    console.error("[waitlist] Error revisando lista de espera:", err)
    return { notified: 0 }
  }
}
