"use client"

import { useEffect, useState } from "react"
import { addDays, format, getDay, isSameDay } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import type { BusinessHours, ScheduleException, Service } from "@/types/scheduling"
import type { AppointmentRow } from "@/app/dashboard/page"

const HOUR_HEIGHT = 56 // px por hora

// Un color estable por servicio (como Google Calendar le da un color distinto
// a cada persona/calendario) — aquí varía por servicio en vez de por barbero,
// ya que hoy solo hay uno.
const SERVICE_COLORS = [
  { bg: "#3b82f6", text: "#ffffff" }, // azul
  { bg: "#f59e0b", text: "#1a1712" }, // ámbar
  { bg: "#a855f7", text: "#ffffff" }, // morado
  { bg: "#14b8a6", text: "#ffffff" }, // verde azulado
  { bg: "#fb923c", text: "#1a1712" }, // naranja
  { bg: "#ec4899", text: "#ffffff" }, // rosa
]
const PENDING_COLOR = { bg: "#d64545", text: "#ffffff" }

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

export function WeekCalendar({
  weekStart,
  appointments,
  services,
  selectedDate,
}: {
  weekStart: Date
  appointments: AppointmentRow[]
  services: Service[]
  selectedDate: string
}) {
  const [hours, setHours] = useState<BusinessHours[] | null>(null)
  const [exceptions, setExceptions] = useState<ScheduleException[]>([])

  useEffect(() => {
    Promise.all([fetch("/api/dashboard/hours").then((r) => r.json()), fetch("/api/dashboard/exceptions").then((r) => r.json())]).then(
      ([h, e]) => {
        setHours(h.hours || [])
        setExceptions(e.exceptions || [])
      }
    )
  }, [])

  if (!hours) return <p className="text-sm text-muted-foreground">Cargando…</p>

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  function rangesForDay(date: Date): { start: string; end: string }[] {
    const dateStr = format(date, "yyyy-MM-dd")
    const exception = exceptions.find((e) => e.date === dateStr)
    if (exception) return exception.is_closed ? [] : exception.ranges || []
    return hours!.find((h) => h.day_of_week === getDay(date))?.ranges || []
  }

  const allRanges = days.flatMap(rangesForDay)
  if (allRanges.length === 0) {
    return <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">Sin horario de atención esta semana.</div>
  }

  const startHour = Math.floor(Math.min(...allRanges.map((r) => timeToMinutes(r.start))) / 60)
  const endHour = Math.ceil(Math.max(...allRanges.map((r) => timeToMinutes(r.end))) / 60)
  const totalHeight = (endHour - startHour) * HOUR_HEIGHT

  function colorFor(appt: AppointmentRow) {
    if (appt.status === "pending_reschedule") return PENDING_COLOR
    const idx = services.findIndex((s) => s.id === appt.service_id)
    return SERVICE_COLORS[idx >= 0 ? idx % SERVICE_COLORS.length : 0]
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Encabezado de días */}
          <div className="flex border-b border-border">
            <div className="w-12 shrink-0" />
            {days.map((d) => {
              const isSelected = format(d, "yyyy-MM-dd") === selectedDate
              const isToday = isSameDay(d, new Date())
              return (
                <div key={d.toISOString()} className={cn("flex-1 text-center py-2 border-l border-border", isSelected && "bg-surface-hover")}>
                  <p className="text-[10px] uppercase text-muted-foreground">{format(d, "EEE", { locale: es })}</p>
                  <p className={cn("text-sm font-semibold", isToday ? "text-gold-bright" : "text-foreground")}>{format(d, "d")}</p>
                </div>
              )
            })}
          </div>

          {/* Grilla */}
          <div className="relative flex" style={{ height: totalHeight }}>
            <div className="w-12 shrink-0 relative">
              {Array.from({ length: endHour - startHour + 1 }).map((_, i) => (
                <div key={i} className="absolute right-1 text-[10px] text-muted-foreground -translate-y-1/2" style={{ top: i * HOUR_HEIGHT }}>
                  {format(new Date(2000, 0, 1, startHour + i), "h a")}
                </div>
              ))}
            </div>

            {days.map((d) => {
              const dateStr = format(d, "yyyy-MM-dd")
              const dayAppointments = appointments.filter(
                (a) => format(new Date(a.starts_at), "yyyy-MM-dd") === dateStr && (a.status === "confirmed" || a.status === "pending_reschedule")
              )
              const closed = rangesForDay(d).length === 0

              return (
                <div key={dateStr} className="relative flex-1 border-l border-border">
                  {Array.from({ length: endHour - startHour + 1 }).map((_, i) => (
                    <div key={i} className="absolute left-0 right-0 border-t border-border/50" style={{ top: i * HOUR_HEIGHT }} />
                  ))}

                  {closed && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground/50 rotate-0">Cerrado</span>
                    </div>
                  )}

                  {dayAppointments.map((appt) => {
                    const startMin = timeToMinutes(format(new Date(appt.starts_at), "HH:mm"))
                    const durationMin = appt.services?.duration_minutes ?? 30
                    const top = ((startMin - startHour * 60) / 60) * HOUR_HEIGHT
                    const height = Math.max((durationMin / 60) * HOUR_HEIGHT, 26)
                    const color = colorFor(appt)

                    return (
                      <div
                        key={appt.id}
                        className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 overflow-hidden shadow-sm"
                        style={{ top, height, backgroundColor: color.bg, color: color.text }}
                        title={`${format(new Date(appt.starts_at), "h:mm a")} · ${appt.clients?.name || appt.clients?.phone} · ${appt.services?.name}`}
                      >
                        <p className="text-[10px] font-semibold leading-tight truncate">{format(new Date(appt.starts_at), "h:mm a")}</p>
                        <p className="text-[10px] leading-tight truncate opacity-90">{appt.clients?.name || appt.clients?.phone}</p>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Leyenda de servicios */}
      <div className="flex flex-wrap gap-3 px-3 py-2 border-t border-border">
        {services.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SERVICE_COLORS[i % SERVICE_COLORS.length].bg }} />
            <span className="text-[11px] text-muted-foreground">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
