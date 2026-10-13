"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

type ClientSuggestion = { id: string; name: string | null; phone: string }

const MAX_SUGGESTIONS = 5
const MIN_CHARS_SEARCH = 2
const SEARCH_DEBOUNCE_MS = 250

// Celular colombiano: 10 dígitos que empiezan por 3, o 12 con el indicativo 57.
// Solo valida; la normalización real la hace el backend (normalizePhone).
function isValidColombianMobile(raw: string): boolean {
  const digits = raw.replace(/\D/g, "")
  return (digits.length === 10 && digits.startsWith("3")) || (digits.length === 12 && digits.startsWith("57"))
}

function localDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return digits.length === 12 && digits.startsWith("57") ? digits.slice(2) : digits
}

// "300 *** 0721": 3 primeros y 4 últimos dígitos, sin el 57, para no mostrar el número completo en pantalla.
function maskPhone(phone: string): string {
  const local = localDigits(phone)
  if (local.length < 8) return "***"
  return `${local.slice(0, 3)} *** ${local.slice(-4)}`
}

function formatLocalPhone(phone: string): string {
  const local = localDigits(phone)
  return local.length === 10 ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : local
}

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
  const [phoneError, setPhoneError] = useState("")
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchAbort = useRef<AbortController | null>(null)

  function cancelSearch() {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchAbort.current?.abort()
    searchTimer.current = null
    searchAbort.current = null
  }

  // Evita timers/fetch colgados si el diálogo se desmonta a mitad de una búsqueda.
  useEffect(() => cancelSearch, [])

  function reset() {
    cancelSearch()
    setServiceId("")
    setClientName("")
    setClientPhone("")
    setStartsAt("")
    setError("")
    setPhoneError("")
    setSuggestions([])
    setSearching(false)
  }

  // La búsqueda se dispara desde el onChange (no desde un useEffect) para poder
  // ignorar el cambio de nombre que provoca elegir una sugerencia.
  function searchClients(text: string) {
    cancelSearch()
    const q = text.trim()
    if (q.length < MIN_CHARS_SEARCH) {
      setSuggestions([])
      setSearching(false)
      return
    }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      const controller = new AbortController()
      searchAbort.current = controller
      try {
        const res = await fetch(`/api/dashboard/clients?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        if (!res.ok) throw new Error("search_failed")
        const json = (await res.json()) as { clients?: ClientSuggestion[] }
        setSuggestions((json.clients || []).slice(0, MAX_SUGGESTIONS))
      } catch (e) {
        // Abort = ya hay otra búsqueda más nueva en curso, no tocar el estado.
        if ((e as Error).name === "AbortError") return
        // Un fallo de red solo apaga las sugerencias; el formulario sigue funcionando.
        setSuggestions([])
      }
      setSearching(false)
    }, SEARCH_DEBOUNCE_MS)
  }

  function handleNameChange(value: string) {
    setClientName(value)
    searchClients(value)
  }

  function pickSuggestion(c: ClientSuggestion) {
    cancelSearch()
    setClientName(c.name || "")
    setClientPhone(formatLocalPhone(c.phone))
    setPhoneError("")
    setSuggestions([])
    setSearching(false)
  }

  async function handleSave() {
    if (!serviceId || !clientPhone || (mode === "single" ? !startsAt : !startTime)) {
      setError("Completa todos los campos requeridos")
      if (!clientPhone) setPhoneError("Escribe el celular del cliente")
      return
    }
    if (!isValidColombianMobile(clientPhone)) {
      setError("")
      setPhoneError("Revisa el número: debe tener 10 dígitos, ej. 300 123 4567")
      return
    }
    setPhoneError("")
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

          <div className="space-y-2">
            <Label htmlFor="client-name">Nombre del cliente</Label>
            <Input
              id="client-name"
              className="h-11"
              value={clientName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Camilo"
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <ul className="overflow-hidden rounded-md border bg-popover text-popover-foreground" aria-label="Clientes existentes">
                {suggestions.map((c) => (
                  <li key={c.id} className="border-b last:border-b-0">
                    <button
                      type="button"
                      onClick={() => pickSuggestion(c)}
                      className="flex min-h-11 w-full items-center px-3 py-2 text-left text-base hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    >
                      {c.name || "Sin nombre"} — {maskPhone(c.phone)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {searching && suggestions.length === 0 && (
              <p className="text-xs text-muted-foreground">Buscando clientes…</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-phone">
              Teléfono (WhatsApp) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="client-phone"
              className="h-11"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={clientPhone}
              onChange={(e) => {
                setClientPhone(e.target.value)
                if (phoneError) setPhoneError("")
              }}
              placeholder="300 123 4567"
              aria-invalid={!!phoneError}
              aria-describedby="client-phone-help"
              required
            />
            <p id="client-phone-help" className={phoneError ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>
              {phoneError || "Celular de WhatsApp, con o sin 57"}
            </p>
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
