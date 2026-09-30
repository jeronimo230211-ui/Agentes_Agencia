// Tipos que reflejan 1:1 el schema en db/migrations/001_schema.sql

export type AppointmentStatus = "confirmed" | "cancelled" | "completed" | "no_show" | "pending_reschedule"
export type AppointmentSource = "whatsapp" | "dashboard" | "recurring"
export type WhatsAppProvider = "360dialog" | "meta" | "twilio"
export type NotificationType =
  | "confirmation"
  | "reminder_24h"
  | "reminder_2h"
  | "confirmation_request"
  | "cancellation_notice"
  | "reschedule_offer"
  | "review_request"
  | "waitlist_opening"

export interface TimeRange {
  start: string // "HH:mm"
  end: string // "HH:mm"
}

export interface Business {
  id: string
  name: string
  slug: string
  timezone: string
  whatsapp_provider: WhatsAppProvider | null
  whatsapp_provider_config: Record<string, string>
  google_calendar_tokens: { access_token?: string; refresh_token?: string; expiry_date?: number } | null
  /** Anticipación mínima en horas para agendar Y cancelar por WhatsApp
   *  (el nombre de la columna es histórico — antes solo aplicaba a cancelar). */
  cancellation_window_hours: number
  buffer_minutes: number
  reminder_hours_before: number[]
  greeting: string
  address: string | null
  active: boolean
  created_at: string
}

export interface Barber {
  id: string
  business_id: string
  name: string
  phone: string | null
  google_calendar_id: string | null
  active: boolean
  created_at: string
}

export interface Service {
  id: string
  business_id: string
  name: string
  duration_minutes: number
  price: number | null
  active: boolean
  sort_order: number
  created_at: string
}

export interface BusinessHours {
  id: string
  barber_id: string
  day_of_week: number // 0=domingo … 6=sábado
  ranges: TimeRange[]
  updated_at: string
}

export interface ScheduleException {
  id: string
  barber_id: string
  date: string // "YYYY-MM-DD"
  is_closed: boolean
  ranges: TimeRange[] | null
  reason: string | null
  created_at: string
}

export interface Client {
  id: string
  business_id: string
  name: string | null
  phone: string
  notes: string | null
  no_show_count: number
  created_at: string
  updated_at: string
}

export interface RecurringBooking {
  id: string
  business_id: string
  barber_id: string
  service_id: string
  client_id: string
  day_of_week: number
  start_time: string // "HH:mm"
  active: boolean
  generated_until: string | null
  created_at: string
}

export interface Appointment {
  id: string
  business_id: string
  barber_id: string
  service_id: string
  client_id: string
  recurring_booking_id: string | null
  starts_at: string // ISO timestamptz
  ends_at: string
  status: AppointmentStatus
  source: AppointmentSource
  google_calendar_event_id: string | null
  notes: string | null
  confirmed_at: string | null
  cancelled_at: string | null
  cancelled_reason: string | null
  created_at: string
  updated_at: string
}

export interface NotificationLogEntry {
  id: string
  business_id: string
  appointment_id: string | null
  client_id: string | null
  type: NotificationType
  channel: string
  status: "sent" | "failed"
  sent_at: string
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  ts: string
}

export interface Conversation {
  id: string
  business_id: string
  client_phone: string
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}

export type WaitlistStatus = "waiting" | "notified" | "booked" | "cancelled"

export interface WaitlistEntry {
  id: string
  business_id: string
  barber_id: string
  client_id: string
  service_id: string
  requested_date: string // "YYYY-MM-DD"
  status: WaitlistStatus
  created_at: string
  notified_at: string | null
}

export interface Broadcast {
  id: string
  business_id: string
  message: string
  range_start: string
  range_end: string
  affected_count: number
  created_at: string
}
