"use client"

import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { Service } from "@/types/scheduling"

// Alex trabaja en bloques de 30 min — los turnos se ofrecen cada 30 min
// (9:00, 9:30, 10:00…), así que un servicio dura 30 min o 1 hora.
const DURATION_OPTIONS = [
  { value: "30", label: "30 min" },
  { value: "60", label: "1 hora" },
]

function DurationSelect({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  // Si un servicio viejo tiene otra duración (ej. 45), se muestra igual para no esconderla.
  const options = DURATION_OPTIONS.some((o) => o.value === String(value))
    ? DURATION_OPTIONS
    : [...DURATION_OPTIONS, { value: String(value), label: `${value} min` }]
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default function ServiciosPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [newDuration, setNewDuration] = useState(30)

  async function load() {
    const res = await fetch("/api/dashboard/services")
    const json = await res.json()
    setServices(json.services || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function updateService(id: string, updates: Partial<Service>) {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)))
    await fetch("/api/dashboard/services", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    })
  }

  async function addService() {
    if (!newName || !newDuration) return
    await fetch("/api/dashboard/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, duration_minutes: newDuration }),
    })
    setNewName("")
    setNewDuration(30)
    load()
  }

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Servicios</h1>
        <p className="text-sm text-muted-foreground">Duración de cada servicio — el agente la usa para calcular qué turnos ofrecer.</p>
      </div>

      <div className="space-y-2">
        {services.map((s) => (
          <Card key={s.id} className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Input
                value={s.name}
                onChange={(e) => updateService(s.id, { name: e.target.value })}
                className="font-medium border-0 px-0 shadow-none focus-visible:ring-0 text-base"
              />
              <div className="flex items-center gap-2 shrink-0">
                <Label className="text-xs text-muted-foreground">Activo</Label>
                <Switch checked={s.active} onCheckedChange={(checked) => updateService(s.id, { active: checked })} />
              </div>
            </div>
            <div className="space-y-1 max-w-[12rem]">
              <Label className="text-xs">Duración</Label>
              <DurationSelect value={s.duration_minutes} onChange={(minutes) => updateService(s.id, { duration_minutes: minutes })} />
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold text-sm">Agregar servicio</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Nombre</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Diseño de barba" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Duración</Label>
            <DurationSelect value={newDuration} onChange={setNewDuration} />
          </div>
        </div>
        <Button size="sm" onClick={addService} disabled={!newName}>
          <Plus size={14} /> Agregar
        </Button>
      </Card>
    </div>
  )
}
