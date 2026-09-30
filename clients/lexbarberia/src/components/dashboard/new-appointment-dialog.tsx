"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Service } from "@/types/scheduling"

const DAYS = [
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miércoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sábado" },
  { value: "0", label: "Domingo" },
]

export function NewAppointmentDialog({
  open,
  onOpenChange,
  services,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  services: Service[]
  onCreated: () => void
}) {
  const [mode, setMode] = useState<"single" | "recurring">("single")
  const [serviceId, setServiceId] = useState("")
  const [clientName, setClientName] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [dayOfWeek, setDayOfWeek] = useState("5")
  const [startTime, setStartTime] = useState("14:00")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function reset() {
    setServiceId("")
    setClientName("")
    setClientPhone("")
    setStartsAt("")
    setError("")
  }

  async function handleSave() {
    if (!serviceId || !clientPhone || (mode === "single" ? !startsAt : !startTime)) {
      setError("Completa todos los campos requeridos")
      return
    }
    setSaving(true)
    setError("")

    const body =
      mode === "single"
        ? { mode, serviceId, clientPhone, clientName, startsAt }
        : { mode, serviceId, clientPhone, clientName, dayOfWeek: Number(dayOfWeek), startTime }

    const res = await fetch("/api/dashboard/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    setSaving(false)

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error === "horario_ya_tomado" ? "Ese horario ya está ocupado." : json.error || "Error al guardar")
      return
    }

    reset()
    onOpenChange(false)
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva cita</DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "recurring")}>
          <TabsList className="w-full">
            <TabsTrigger value="single" className="flex-1">Una vez</TabsTrigger>
            <TabsTrigger value="recurring" className="flex-1">Recurrente</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Servicio</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un servicio" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.duration_minutes} min)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nombre del cliente</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Camilo" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono (WhatsApp)</Label>
              <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="573001234567" />
            </div>
          </div>

          {mode === "single" ? (
            <div className="space-y-2">
              <Label>Fecha y hora</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Día de la semana</Label>
                <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">
                Se crean automáticamente las próximas 8 semanas de citas en ese día y hora (saltando los días que estén cerrados).
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
