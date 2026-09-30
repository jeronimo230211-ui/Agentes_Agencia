// Integración con Google Calendar. Cada cita creada/cancelada intenta
// reflejarse en el calendario de Google del barbero — pero nunca debe
// tumbar el flujo de agendamiento si falla (la cita en Supabase manda,
// el calendario es un espejo best-effort).

import { google } from "googleapis"
import type { createServiceClient } from "./supabase"
import type { Appointment, Barber, Business, Client, Service } from "@/types/scheduling"

type Db = ReturnType<typeof createServiceClient>
type GoogleTokens = { access_token?: string; refresh_token?: string; expiry_date?: number }

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

function getClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error("Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET")
  return { clientId, clientSecret }
}

export function createOAuthClient(redirectUri: string) {
  const { clientId, clientSecret } = getClientCredentials()
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export function getGoogleAuthUrl(redirectUri: string): string {
  const client = createOAuthClient(redirectUri)
  return client.generateAuthUrl({
    access_type: "offline", // necesario para recibir refresh_token
    prompt: "consent", // fuerza a que siempre devuelva refresh_token, incluso en reconexiones
    scope: SCOPES,
  })
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokens> {
  const client = createOAuthClient(redirectUri)
  const { tokens } = await client.getToken(code)
  return {
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  }
}

/** Crea un cliente autorizado y persiste automáticamente el access_token
 *  renovado (Google lo refresca solo internamente cuando expira). */
function getAuthorizedClient(db: Db, businessId: string, tokens: GoogleTokens) {
  const client = createOAuthClient("") // redirectUri no se usa fuera del flujo de auth inicial
  client.setCredentials(tokens)
  client.on("tokens", (newTokens) => {
    const merged = { ...tokens, ...newTokens }
    db.from("business")
      .update({ google_calendar_tokens: merged })
      .eq("id", businessId)
      .then(() => {})
  })
  return client
}

function eventPayload(appointment: Appointment, service: Service, client: Client, businessName: string, address: string | null) {
  return {
    summary: `${service.name} — ${client.name || client.phone}`,
    description: `Cita agendada por WhatsApp para ${businessName}.\nCliente: ${client.name || "sin nombre"} (${client.phone})\nServicio: ${service.name}`,
    location: address || undefined,
    start: { dateTime: appointment.starts_at },
    end: { dateTime: appointment.ends_at },
  }
}

/** Best-effort: crea el evento y guarda su id en la cita. Nunca lanza. */
export async function syncAppointmentToCalendar(
  db: Db,
  business: Business,
  barber: Barber,
  appointment: Appointment,
  service: Service,
  client: Client
): Promise<void> {
  if (!business.google_calendar_tokens) return

  try {
    const auth = getAuthorizedClient(db, business.id, business.google_calendar_tokens)
    const calendar = google.calendar({ version: "v3", auth })
    const calendarId = barber.google_calendar_id || "primary"

    const { data } = await calendar.events.insert({
      calendarId,
      requestBody: eventPayload(appointment, service, client, business.name, business.address),
    })

    if (data.id) {
      await db.from("appointments").update({ google_calendar_event_id: data.id }).eq("id", appointment.id)
    }
  } catch (err) {
    console.error("[google-calendar] No se pudo crear el evento:", err)
  }
}

/** Best-effort: borra el evento de una cita cancelada. Nunca lanza. */
export async function removeAppointmentFromCalendar(db: Db, business: Business, barber: Barber, appointment: Appointment): Promise<void> {
  if (!business.google_calendar_tokens || !appointment.google_calendar_event_id) return

  try {
    const auth = getAuthorizedClient(db, business.id, business.google_calendar_tokens)
    const calendar = google.calendar({ version: "v3", auth })
    await calendar.events.delete({
      calendarId: barber.google_calendar_id || "primary",
      eventId: appointment.google_calendar_event_id,
    })
  } catch (err) {
    console.error("[google-calendar] No se pudo borrar el evento:", err)
  }
}
