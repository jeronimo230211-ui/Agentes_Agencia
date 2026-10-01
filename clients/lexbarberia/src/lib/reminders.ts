// Recordatorio automático de cita: se envía X horas antes (Ajustes → Negocio),
// antes de que se cierre la ventana de cancelación, para que el cliente que
// no puede ir avise a tiempo y el turno se libere. Lleva dos botones:
// "Ahí estaré" confirma y "No puedo ir" cancela — ambos se resuelven aquí
// con lógica fija, sin pasar por el modelo.

import { formatInTimeZone } from "date-fns-tz"
import type { createServiceClient } from "./supabase"
import { cancelAppointment, checkWaitlistForBarber } from "./booking-service"
import { removeAppointmentFromCalendar } from "./google-calendar"
import { sendMetaTemplate } from "./whatsapp"
import type { Appointment, Barber, Business, ChatMessage } from "@/types/scheduling"

type Db = ReturnType<typeof createServiceClient>

/** Nombre de la plantilla en Meta (scripts: ver PROJECT.md → Recordatorios). */
export const REMINDER_TEMPLATE = "recordatorio_cita"
const REMINDER_LANGUAGE = "es"
/** El check de la BD solo admite estos tipos; se reusa 'reminder_2h' para "el recordatorio previo a la cita". */
const REMINDER_LOG_TYPE = "reminder_2h"
const DEFAULT_REMINDER_HOURS = 3

const PAYLOAD_CONFIRM = "rem:ok:"
const PAYLOAD_CANCEL = "rem:no:"

/** "6:00 pm" — mismo estilo corto con el que escribe Alex. */
function shortTime(date: Date, timezone: string): string {
  const hour = Number(formatInTimeZone(date, timezone, "H"))
  return `${formatInTimeZone(date, timezone, "h:mm")} ${hour < 12 ? "am" : "pm"}`
}

/** "hoy a las 6:00 pm" / "mañana a las…" / "el viernes 2 de octubre a las…" */
function appointmentWhen(startsAt: Date, timezone: string): string {
  const day = formatInTimeZone(startsAt, timezone, "yyyy-MM-dd")
  const today = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd")
  const tomorrow = formatInTimeZone(new Date(Date.now() + 24 * 60 * 60 * 1000), timezone, "yyyy-MM-dd")
  const prefix = day === today ? "hoy" : day === tomorrow ? "mañana" : `el ${formatInTimeZone(startsAt, timezone, "d/MM")}`
  return `${prefix} a las ${shortTime(startsAt, timezone)}`
}

export function reminderHours(business: Business): number {
  return business.reminder_hours_before?.[0] ?? DEFAULT_REMINDER_HOURS
}

/** Guarda en el historial lo que el sistema le escribió al cliente, para que el
 *  agente tenga contexto si el cliente responde escribiendo en vez de tocar un botón. */
async function appendToConversation(db: Db, businessId: string, phone: string, content: string) {
  const entry: ChatMessage = { role: "assistant", content, ts: new Date().toISOString() }
  const { data: existing } = await db.from("conversations").select("id, messages").eq("business_id", businessId).eq("client_phone", phone).single()
  if (existing) {
    await db.from("conversations").update({ messages: [...((existing.messages as ChatMessage[]) || []), entry] }).eq("id", existing.id)
  } else {
    await db.from("conversations").insert({ business_id: businessId, client_phone: phone, messages: [entry] })
  }
}

export interface ReminderRunResult {
  sent: number
  failed: number
  skipped: number
}

/** Envía los recordatorios que ya tocan. Idempotente: cada cita recibe a lo
 *  sumo uno (se revisa notifications_log), así que se puede correr cada pocos minutos. */
export async function sendDueReminders(db: Db, business: Business): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { sent: 0, failed: 0, skipped: 0 }
  if (business.whatsapp_provider !== "meta") return result

  const hours = reminderHours(business)
  const now = Date.now()
  const windowEnd = new Date(now + hours * 60 * 60 * 1000)
  // Si el recordatorio sale antes del límite de cancelación, solo tiene sentido
  // mientras todavía se pueda cancelar; si no, basta con que la cita no haya pasado.
  const lowerBound = new Date(now + (hours > business.cancellation_window_hours ? business.cancellation_window_hours : 0) * 60 * 60 * 1000)

  const { data: appointments } = await db
    .from("appointments")
    .select("*, clients(id, name, phone)")
    .eq("business_id", business.id)
    .eq("status", "confirmed")
    .gt("starts_at", lowerBound.toISOString())
    .lte("starts_at", windowEnd.toISOString())

  for (const appt of (appointments || []) as (Appointment & { clients: { id: string; name: string | null; phone: string } | null })[]) {
    const startsAt = new Date(appt.starts_at)

    // Agendada ya dentro de la ventana (ej. a las 4 para las 6): acaba de recibir
    // la confirmación, un recordatorio encima sería ruido.
    if (!appt.clients || new Date(appt.created_at).getTime() > startsAt.getTime() - hours * 60 * 60 * 1000) {
      result.skipped++
      continue
    }

    const { data: alreadySent } = await db
      .from("notifications_log")
      .select("id")
      .eq("appointment_id", appt.id)
      .eq("type", REMINDER_LOG_TYPE)
      .limit(1)
    if (alreadySent && alreadySent.length > 0) {
      result.skipped++
      continue
    }

    const name = appt.clients.name?.trim() || "de nuevo"
    const when = appointmentWhen(startsAt, business.timezone)
    const deadline = shortTime(new Date(startsAt.getTime() - business.cancellation_window_hours * 60 * 60 * 1000), business.timezone)

    let status: "sent" | "failed" = "sent"
    try {
      await sendMetaTemplate(business.whatsapp_provider_config, appt.clients.phone, {
        name: REMINDER_TEMPLATE,
        language: REMINDER_LANGUAGE,
        bodyParams: [name, when, deadline],
        buttonPayloads: [`${PAYLOAD_CONFIRM}${appt.id}`, `${PAYLOAD_CANCEL}${appt.id}`],
      })
      await appendToConversation(
        db,
        business.id,
        appt.clients.phone,
        `[Recordatorio automático] Hola ${name}, le recuerdo su cita ${when} 💈 Si no puede venir, por favor avíseme antes de las ${deadline}.\n\nA. Ahí estaré\nB. No puedo ir`
      )
      result.sent++
    } catch (err) {
      console.error("[reminders] No se pudo enviar el recordatorio:", err)
      status = "failed"
      result.failed++
    }

    // También se registra el fallo: así no se reintenta cada 15 min contra un error
    // permanente (plantilla no aprobada, número no permitido) y queda visible.
    await db.from("notifications_log").insert({
      business_id: business.id,
      appointment_id: appt.id,
      client_id: appt.clients.id,
      type: REMINDER_LOG_TYPE,
      status,
    })
  }

  return result
}

/** Resuelve un toque en los botones del recordatorio. Devuelve el texto a
 *  responder, o null si el payload no es de un recordatorio. */
export async function handleReminderButton(
  db: Db,
  business: Business,
  barber: Barber,
  phone: string,
  payload: string
): Promise<string | null> {
  const isConfirm = payload.startsWith(PAYLOAD_CONFIRM)
  const isCancel = payload.startsWith(PAYLOAD_CANCEL)
  if (!isConfirm && !isCancel) return null

  const appointmentId = payload.slice((isConfirm ? PAYLOAD_CONFIRM : PAYLOAD_CANCEL).length)
  const { data: appt } = await db
    .from("appointments")
    .select("*, clients!inner(name, phone)")
    .eq("id", appointmentId)
    .eq("clients.phone", phone) // un payload solo sirve para las citas del propio cliente
    .single()

  if (!appt || appt.status !== "confirmed") return "Esa cita ya no está activa 👍🏽 Si quiere una nueva, escríbame el día y la hora que prefiere."

  const startsAt = new Date(appt.starts_at as string)
  const when = appointmentWhen(startsAt, business.timezone)
  const name = (appt.clients as { name: string | null } | null)?.name

  if (isConfirm) {
    await db.from("appointments").update({ confirmed_at: new Date().toISOString() }).eq("id", appointmentId)
    return `Listo${name ? ` ${name}` : ""}... lo espero ${when} 👍🏽💈`
  }

  const result = await cancelAppointment(db, appointmentId, new Date(), business.cancellation_window_hours, "Canceló desde el recordatorio")
  if (!result.ok) {
    if (result.reason === "too_late") {
      return `Ya faltan menos de ${business.cancellation_window_hours} horas para su cita, así que no alcanzo a liberar el turno por aquí 🙏 Si es una urgencia, escríbale directamente a ${barber.name}.`
    }
    return "Esa cita ya no está activa 👍🏽"
  }

  await removeAppointmentFromCalendar(db, business, barber, result.appointment)
  await checkWaitlistForBarber(db, business, barber)
  return "Si dale tranquilo 👍🏽💈 Su cita quedó cancelada. Si quiere reagendar, escríbame el día y la hora que prefiere."
}
