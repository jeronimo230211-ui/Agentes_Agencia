"use client"

import { useEffect, useState } from "react"
import { ChevronDown, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { BusinessHours, ScheduleException, TimeRange } from "@/types/scheduling"

// Lunes a domingo, en orden natural de lectura (day_of_week sigue siendo 0=domingo internamente).
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_LABELS: Record<number, string> = { 0: "Domingo", 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado" }
const DAY_CHIPS: Record<number, string> = { 1: "L", 2: "M", 3: "M", 4: "J", 5: "V", 6: "S", 0: "D" }

type DayForm = { day_of_week: number; ranges: TimeRange[] }

function formatRange(r: TimeRange) {
  const fmt = (t: string) => {
    const [h, m] = t.split(":").map(Number)
    const period = h >= 12 ? "pm" : "am"
    const h12 = h % 12 === 0 ? 12 : h % 12
    return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, "0")}${period}`
  }
  return `${fmt(r.start)}–${fmt(r.end)}`
}

function RangesEditor({
  ranges,
  onChange,
}: {
  ranges: TimeRange[]
  onChange: (ranges: TimeRange[]) => void
}) {
  return (
    <div className="space-y-2">
      {ranges.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input type="time" value={r.start} onChange={(e) => onChange(ranges.map((x, xi) => (xi === i ? { ...x, start: e.target.value } : x)))} className="h-9" />
          <span className="text-xs text-muted-foreground shrink-0">a</span>
          <Input type="time" value={r.end} onChange={(e) => onChange(ranges.map((x, xi) => (xi === i ? { ...x, end: e.target.value } : x)))} className="h-9" />
          <button
            type="button"
            onClick={() => onChange(ranges.filter((_, xi) => xi !== i))}
            className="shrink-0 text-muted-foreground hover:text-destructive p-1"
            aria-label="Quitar tramo"
          >
            <X size={15} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...ranges, { start: "09:00", end: "18:00" }])}
        className="flex items-center gap-1 text-sm text-gold-bright hover:underline"
      >
        <Plus size={14} /> Agregar tramo
      </button>
    </div>
  )
}

export function HorariosTab() {
  const [days, setDays] = useState<DayForm[]>(DISPLAY_ORDER.map((d) => ({ day_of_week: d, ranges: [] })))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expandedDay, setExpandedDay] = useState<number | null>(null)

  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set())
  const [bulkRanges, setBulkRanges] = useState<TimeRange[]>([{ start: "09:00", end: "18:00" }])
  const [bulkClosed, setBulkClosed] = useState(false)

  const [exceptions, setExceptions] = useState<ScheduleException[]>([])
  const [excFrom, setExcFrom] = useState("")
  const [excTo, setExcTo] = useState("")
  const [excReason, setExcReason] = useState("")

  async function load() {
    const [hoursRes, excRes] = await Promise.all([fetch("/api/dashboard/hours"), fetch("/api/dashboard/exceptions")])
    const hoursJson = await hoursRes.json()
    const excJson = await excRes.json()
    const byDay = new Map<number, TimeRange[]>((hoursJson.hours || []).map((h: BusinessHours) => [h.day_of_week, h.ranges]))
    setDays(DISPLAY_ORDER.map((d) => ({ day_of_week: d, ranges: byDay.get(d) || [] })))
    setExceptions(excJson.exceptions || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function setDayRanges(dayOfWeek: number, ranges: TimeRange[]) {
    setDays((prev) => prev.map((d) => (d.day_of_week === dayOfWeek ? { ...d, ranges } : d)))
  }

  function toggleSelectedDay(d: number) {
    setSelectedDays((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  function applyBulk() {
    if (selectedDays.size === 0) return
    setDays((prev) => prev.map((d) => (selectedDays.has(d.day_of_week) ? { ...d, ranges: bulkClosed ? [] : bulkRanges.map((r) => ({ ...r })) } : d)))
    setSelectedDays(new Set())
  }

  async function save() {
    setSaving(true)
    await fetch("/api/dashboard/hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function addException() {
    if (!excFrom) return
    const dates: string[] = []
    const start = new Date(`${excFrom}T00:00:00`)
    const end = new Date(`${excTo || excFrom}T00:00:00`)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) dates.push(d.toISOString().slice(0, 10))
    await fetch("/api/dashboard/exceptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dates, is_closed: true, reason: excReason || null }),
    })
    setExcFrom("")
    setExcTo("")
    setExcReason("")
    load()
  }

  async function removeException(id: string) {
    await fetch(`/api/dashboard/exceptions?id=${id}`, { method: "DELETE" })
    load()
  }

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>

  return (
    <div className="space-y-6">
      {/* Aplicación rápida a varios días */}
      <Card className="p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-sm">Aplicar horario a varios días</h2>
          <p className="text-xs text-muted-foreground">Elige los días, define el horario una sola vez y aplícalo a todos juntos.</p>
        </div>

        <div className="flex gap-1.5">
          {DISPLAY_ORDER.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleSelectedDay(d)}
              className={cn(
                "h-9 w-9 rounded-full text-sm font-semibold border transition-colors",
                selectedDays.has(d) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-gold"
              )}
            >
              {DAY_CHIPS[d]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={bulkClosed} onCheckedChange={setBulkClosed} />
          <Label className="text-sm">Marcar como cerrado</Label>
        </div>

        {!bulkClosed && <RangesEditor ranges={bulkRanges} onChange={setBulkRanges} />}

        <Button size="sm" onClick={applyBulk} disabled={selectedDays.size === 0} className="w-full">
          Aplicar a {selectedDays.size || "los días seleccionados"}
        </Button>
      </Card>

      {/* Resumen compacto por día, editable individualmente */}
      <Card className="divide-y divide-border overflow-hidden p-0">
        {days.map((day) => {
          const isOpen = day.ranges.length > 0
          const expanded = expandedDay === day.day_of_week
          return (
            <div key={day.day_of_week}>
              <button
                type="button"
                onClick={() => setExpandedDay(expanded ? null : day.day_of_week)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors"
              >
                <span className="font-medium text-sm w-24 shrink-0">{DAY_LABELS[day.day_of_week]}</span>
                <span className={cn("flex-1 text-sm truncate", isOpen ? "text-muted-foreground" : "text-muted-foreground/60 italic")}>
                  {isOpen ? day.ranges.map(formatRange).join(", ") : "Cerrado"}
                </span>
                <ChevronDown size={16} className={cn("text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")} />
              </button>

              {expanded && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={isOpen} onCheckedChange={(checked) => setDayRanges(day.day_of_week, checked ? [{ start: "09:00", end: "18:00" }] : [])} />
                    <Label className="text-sm">{isOpen ? "Abierto" : "Cerrado"}</Label>
                  </div>
                  {isOpen && <RangesEditor ranges={day.ranges} onChange={(r) => setDayRanges(day.day_of_week, r)} />}
                </div>
              )}
            </div>
          )
        })}
      </Card>

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? "Guardando…" : saved ? "✓ Guardado" : "Guardar horario"}
      </Button>

      {/* Excepciones puntuales */}
      <div className="space-y-3 pt-2">
        <div>
          <h2 className="text-base font-bold">Cerrar días puntuales</h2>
          <p className="text-sm text-muted-foreground">Para vacaciones, imprevistos, etc. — sin tocar tu horario normal de arriba.</p>
        </div>

        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={excFrom} onChange={(e) => setExcFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta (opcional)</Label>
              <Input type="date" value={excTo} onChange={(e) => setExcTo(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Motivo (opcional)</Label>
            <Textarea rows={2} value={excReason} onChange={(e) => setExcReason(e.target.value)} placeholder="Cita médica" />
          </div>
          <Button size="sm" onClick={addException} disabled={!excFrom}>
            Cerrar estos días
          </Button>
        </Card>

        {exceptions.length > 0 && (
          <div className="space-y-2">
            {exceptions.map((e) => (
              <Card key={e.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{e.date}</p>
                  {e.reason && <p className="text-xs text-muted-foreground">{e.reason}</p>}
                </div>
                <Button size="icon-sm" variant="ghost" onClick={() => removeException(e.id)}>
                  <Trash2 size={14} />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
