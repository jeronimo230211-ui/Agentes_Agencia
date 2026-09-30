// Motor de disponibilidad — lógica pura, sin dependencias de Supabase ni
// de Next.js, para poder probarla de forma aislada.
//
// Todo el cálculo de "qué horas están libres" pasa por aquí. Las horas de
// negocio (business_hours / schedule_exceptions) se guardan como
// "hora de pared" (wall-clock) en la zona horaria del negocio; se
// convierten a instantes UTC solo al comparar contra citas existentes.

import { addDays, addMinutes, format, getDay, isBefore, parse } from "date-fns"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"
import type { BusinessHours, RecurringBooking, ScheduleException, TimeRange } from "@/types/scheduling"

export interface BusyInterval {
  start: Date
  end: Date
}

/** Rangos horarios efectivos de un barbero para una fecha concreta,
 *  ya resolviendo si esa fecha tiene una excepción (cerrado u horario
 *  especial) o si aplica la plantilla semanal normal. */
export function getEffectiveRanges(
  dateStr: string, // "YYYY-MM-DD"
  weeklyHours: BusinessHours[],
  exceptions: ScheduleException[]
): TimeRange[] {
  const exception = exceptions.find((e) => e.date === dateStr)
  if (exception) {
    if (exception.is_closed) return []
    return exception.ranges ?? []
  }
  const dayOfWeek = getDay(parse(dateStr, "yyyy-MM-dd", new Date()))
  const weekly = weeklyHours.find((h) => h.day_of_week === dayOfWeek)
  return weekly?.ranges ?? []
}

/** Convierte una hora de pared ("HH:mm") de una fecha concreta, en la
 *  zona horaria del negocio, a un instante UTC real. */
function zonedDateTime(dateStr: string, time: string, timezone: string): Date {
  return fromZonedTime(`${dateStr}T${time}:00`, timezone)
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return isBefore(aStart, bEnd) && isBefore(bStart, aEnd)
}

export interface AvailabilityParams {
  timezone: string
  weeklyHours: BusinessHours[]
  exceptions: ScheduleException[]
  /** Citas ya confirmadas del barbero en el rango de búsqueda (o más). */
  busy: BusyInterval[]
  durationMinutes: number
  bufferMinutes: number
  fromDate: Date
  toDate: Date
  /** Paso entre horas candidatas ofrecidas al cliente. Default 30 min —
   *  Alex trabaja en bloques de 30 min / 1 hora (9:00, 9:30, 10:00…). */
  slotGranularityMinutes?: number
  /** No ofrecer horas anteriores a este instante. Default: ahora. Para
   *  exigir anticipación mínima, pasar ahora + N horas. */
  now?: Date
  maxResults?: number
  /** Tope de resultados por día — evita que un solo día (con su montón de
   *  turnos) agote maxResults antes de llegar a días siguientes. */
  maxResultsPerDay?: number
}

/** Calcula las horas de inicio disponibles para un servicio, cruzando
 *  horario del negocio − excepciones − citas ya tomadas − buffer. */
export function computeAvailableSlots(params: AvailabilityParams): Date[] {
  const {
    timezone,
    weeklyHours,
    exceptions,
    busy,
    durationMinutes,
    bufferMinutes,
    fromDate,
    toDate,
    slotGranularityMinutes = 30,
    now = new Date(),
    maxResults,
    maxResultsPerDay,
  } = params

  // Busy intervals con buffer aplicado a ambos lados, para garantizar el
  // descanso configurado antes y después de cada cita existente.
  const paddedBusy: BusyInterval[] = busy.map((b) => ({
    start: addMinutes(b.start, -bufferMinutes),
    end: addMinutes(b.end, bufferMinutes),
  }))

  const results: Date[] = []
  const countPerDay = new Map<string, number>()
  let cursorDate = fromDate

  while (!isBefore(toDate, cursorDate)) {
    // La fecha se toma en la zona del negocio, no la del servidor (UTC en
    // Vercel) — si no, desde las 7pm de Colombia ya "es mañana" y se salta el día.
    const dateStr = formatInTimeZone(cursorDate, timezone, "yyyy-MM-dd")
    const ranges = getEffectiveRanges(dateStr, weeklyHours, exceptions)

    for (const range of ranges) {
      let candidate = zonedDateTime(dateStr, range.start, timezone)
      const rangeEnd = zonedDateTime(dateStr, range.end, timezone)

      while (true) {
        const candidateEnd = addMinutes(candidate, durationMinutes)
        if (isBefore(rangeEnd, candidateEnd)) break // ya no cabe el servicio en el rango

        const isPast = isBefore(candidate, now)
        const isFree = !paddedBusy.some((b) => overlaps(candidate, candidateEnd, b.start, b.end))
        const dayCount = countPerDay.get(dateStr) ?? 0
        const dayFull = maxResultsPerDay !== undefined && dayCount >= maxResultsPerDay

        if (!isPast && isFree && !dayFull) {
          results.push(candidate)
          countPerDay.set(dateStr, dayCount + 1)
          if (maxResults && results.length >= maxResults) return results
        }

        candidate = addMinutes(candidate, slotGranularityMinutes)
      }
    }

    cursorDate = addDays(cursorDate, 1)
  }

  return results
}

/** Punto 9: cancelación solo permitida hasta `windowHours` antes de la cita. */
export function isCancellationAllowed(appointmentStartsAt: Date, now: Date, windowHours: number): boolean {
  const windowMs = windowHours * 60 * 60 * 1000
  return appointmentStartsAt.getTime() - now.getTime() >= windowMs
}

export interface RecurringOccurrence {
  starts_at: Date
  ends_at: Date
}

/** Punto 3: genera las citas concretas de una reserva periódica
 *  ("todos los viernes 2pm") entre dos fechas, saltando los días
 *  donde el barbero esté cerrado por excepción. No valida choques
 *  con otras citas — eso lo resuelve el constraint de la base de
 *  datos / el flujo de agendamiento al insertar. */
export function generateRecurringOccurrences(
  recurring: Pick<RecurringBooking, "day_of_week" | "start_time">,
  durationMinutes: number,
  timezone: string,
  fromDate: Date,
  toDate: Date,
  exceptions: ScheduleException[]
): RecurringOccurrence[] {
  const occurrences: RecurringOccurrence[] = []
  let cursor = fromDate

  while (!isBefore(toDate, cursor)) {
    if (getDay(cursor) === recurring.day_of_week) {
      const dateStr = format(cursor, "yyyy-MM-dd")
      const exception = exceptions.find((e) => e.date === dateStr)
      const isClosed = exception?.is_closed ?? false

      if (!isClosed) {
        const starts_at = zonedDateTime(dateStr, recurring.start_time, timezone)
        occurrences.push({ starts_at, ends_at: addMinutes(starts_at, durationMinutes) })
      }
    }
    cursor = addDays(cursor, 1)
  }

  return occurrences
}
