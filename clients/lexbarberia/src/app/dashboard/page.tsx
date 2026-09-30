"use client"

import { useEffect, useState, useCallback } from "react"
import { addDays, format, startOfWeek } from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Plus, Check, X, UserX, List, CalendarRange } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { NewAppointmentDialog } from "@/components/dashboard/new-appointment-dialog"
import { WeekCalendar } from "@/components/dashboard/week-calendar"
import { cn } from "@/lib/utils"
import type { Appointment, AppointmentStatus, Service } from "@/types/scheduling"

type ViewMode = "list" | "calendar"
const VIEW_STORAGE_KEY = "lexbarberia_hoy_view"

export type AppointmentRow = Appointment & {
  clients: { name: string | null; phone: string } | null
  services: { name: string; duration_minutes: number } | null
}

const statusLabel: Record<AppointmentStatus, string> = {
  confirmed: "Confirmada",
  pending_reschedule: "Por reprogramar",
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "No asistió",
}

const statusVariant: Record<AppointmentStatus, "default" | "secondary" | "destructive" | "outline"> = {
  confirmed: "default",
  pending_reschedule: "outline",
  cancelled: "destructive",
  completed: "secondary",
  no_show: "destructive",
}

export default function TodayPage() {
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [weekAppointments, setWeekAppointments] = useState<AppointmentRow[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("list")

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY)
      if (saved === "list" || saved === "calendar") setViewMode(saved)
    } catch {
      // ignorar
    }
  }, [])

  function changeView(mode: ViewMode) {
    setViewMode(mode)
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode)
    } catch {
      // ignorar
    }
  }

  const dateObj = new Date(`${selectedDate}T12:00:00`)
  const weekStart = startOfWeek(dateObj, { weekStartsOn: 1 }) // lunes
  const weekStartStr = format(weekStart, "yyyy-MM-dd")

  // Siempre se trae la semana completa — la vista de lista simplemente filtra
  // al día seleccionado, así cambiar de vista no necesita otro fetch.
  const load = useCallback(async () => {
    setLoading(true)
    const from = weekStartStr
    const to = format(addDays(weekStart, 6), "yyyy-MM-dd")
    const res = await fetch(`/api/dashboard/appointments?from=${from}&to=${to}`)
    const json = await res.json()
    setWeekAppointments(json.appointments || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartStr])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetch("/api/dashboard/services")
      .then((r) => r.json())
      .then((j) => setServices((j.services || []).filter((s: Service) => s.active)))
  }, [])

  async function updateStatus(id: string, status: AppointmentStatus) {
    await fetch("/api/dashboard/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })
    load()
  }

  const isToday = selectedDate === format(new Date(), "yyyy-MM-dd")
  const dayAppointments = weekAppointments.filter((a) => format(new Date(a.starts_at), "yyyy-MM-dd") === selectedDate)
  const active = dayAppointments.filter((a) => a.status === "confirmed" || a.status === "pending_reschedule")
  const past = dayAppointments.filter((a) => a.status === "completed" || a.status === "cancelled" || a.status === "no_show")

  function navigate(direction: 1 | -1) {
    const step = viewMode === "calendar" ? 7 : 1
    setSelectedDate(format(addDays(dateObj, direction * step), "yyyy-MM-dd"))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {viewMode === "calendar"
              ? `Semana del ${format(weekStart, "d 'de' MMMM", { locale: es })}`
              : isToday
                ? "Hoy"
                : format(dateObj, "EEEE d 'de' MMMM", { locale: es })}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{format(dateObj, "EEEE d 'de' MMMM, yyyy", { locale: es })}</p>
        </div>
        <Button size="icon" onClick={() => setDialogOpen(true)} aria-label="Nueva cita">
          <Plus size={18} />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} />
        </Button>
        {!isToday && (
          <Button variant="secondary" size="sm" onClick={() => setSelectedDate(format(new Date(), "yyyy-MM-dd"))}>
            Hoy
          </Button>
        )}
        <Button variant="outline" size="icon" onClick={() => navigate(1)}>
          <ChevronRight size={16} />
        </Button>
        <span className="text-sm text-muted-foreground ml-1">
          {active.length} cita{active.length !== 1 ? "s" : ""}
        </span>

        <div className="ml-auto flex rounded-md border border-border overflow-hidden">
          <button
            onClick={() => changeView("list")}
            className={cn("p-2", viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-hover")}
            title="Vista de lista"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => changeView("calendar")}
            className={cn("p-2", viewMode === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-hover")}
            title="Vista de calendario"
          >
            <CalendarRange size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : viewMode === "calendar" ? (
        <WeekCalendar weekStart={weekStart} appointments={weekAppointments} services={services} selectedDate={selectedDate} />
      ) : active.length === 0 && past.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No hay citas este día.</Card>
      ) : (
        <div className="space-y-2">
          {[...active, ...past]
            .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
            .map((appt) => (
              <Card key={appt.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold tabular-nums">{format(new Date(appt.starts_at), "h:mm a")}</span>
                    <Badge variant={statusVariant[appt.status]}>{statusLabel[appt.status]}</Badge>
                  </div>
                  <p className="text-sm mt-0.5 truncate">
                    {appt.clients?.name || appt.clients?.phone || "Cliente"} · {appt.services?.name}
                  </p>
                </div>
                {(appt.status === "confirmed" || appt.status === "pending_reschedule") && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon-sm" variant="secondary" title="Completada" onClick={() => updateStatus(appt.id, "completed")}>
                      <Check size={14} />
                    </Button>
                    <Button size="icon-sm" variant="secondary" title="No asistió" onClick={() => updateStatus(appt.id, "no_show")}>
                      <UserX size={14} />
                    </Button>
                    <Button size="icon-sm" variant="outline" title="Cancelar" onClick={() => updateStatus(appt.id, "cancelled")}>
                      <X size={14} />
                    </Button>
                  </div>
                )}
              </Card>
            ))}
        </div>
      )}

      <NewAppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        services={services}
        onCreated={load}
      />
    </div>
  )
}
