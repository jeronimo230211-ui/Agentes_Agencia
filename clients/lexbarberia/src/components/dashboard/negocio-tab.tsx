"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CalendarCheck2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Business } from "@/types/scheduling"

const PROVIDER_LABEL: Record<string, string> = {
  meta: "Meta WhatsApp Cloud API (número de prueba)",
  "360dialog": "360Dialog",
  twilio: "Twilio",
}

export function NegocioTab() {
  const searchParams = useSearchParams()
  const googleStatus = searchParams.get("google")

  const [business, setBusiness] = useState<Business | null>(null)
  const [address, setAddress] = useState("")
  const [greeting, setGreeting] = useState("")
  const [cancellationHours, setCancellationHours] = useState("2")
  const [bufferMinutes, setBufferMinutes] = useState("0")
  const [reminderHours, setReminderHours] = useState("3")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  async function load() {
    const res = await fetch("/api/dashboard/business")
    const j = await res.json()
    setBusiness(j.business)
    setAddress(j.business?.address || "")
    setGreeting(j.business?.greeting || "")
    setCancellationHours(String(j.business?.cancellation_window_hours ?? 2))
    setBufferMinutes(String(j.business?.buffer_minutes ?? 0))
    setReminderHours(String(j.business?.reminder_hours_before?.[0] ?? 3))
  }

  useEffect(() => {
    load()
  }, [])

  async function save() {
    if (!business) return
    setSaving(true)
    await fetch("/api/dashboard/business", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: business.id,
        address,
        greeting,
        cancellation_window_hours: Number(cancellationHours),
        buffer_minutes: Number(bufferMinutes),
        reminder_hours_before: [Number(reminderHours)],
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function disconnectGoogle() {
    if (!business) return
    setDisconnecting(true)
    await fetch("/api/dashboard/business", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: business.id, disconnect_google: true }),
    })
    setDisconnecting(false)
    load()
  }

  if (!business) return <p className="text-sm text-muted-foreground">Cargando…</p>

  const googleConnected = Boolean(business.google_calendar_tokens?.refresh_token)

  return (
    <div className="space-y-4">
      {googleStatus === "connected" && (
        <Card className="p-3 border-primary/40 bg-primary/10 text-sm">✓ Google Calendar conectado correctamente.</Card>
      )}
      {googleStatus === "denied" && (
        <Card className="p-3 border-destructive/40 bg-destructive/10 text-sm">No se completó la conexión con Google — inténtalo de nuevo.</Card>
      )}
      {googleStatus === "error" && (
        <Card className="p-3 border-destructive/40 bg-destructive/10 text-sm">Hubo un error conectando Google Calendar. Revisa las credenciales.</Card>
      )}

      <Card className="p-4 space-y-4">
        <div className="space-y-1">
          <Label className="text-xs">Dirección</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección de la barbería" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Saludo inicial del agente</Label>
          <Textarea rows={2} value={greeting} onChange={(e) => setGreeting(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Anticipación mínima (horas)</Label>
            <Input type="number" min={0} value={cancellationHours} onChange={(e) => setCancellationHours(e.target.value)} />
            <p className="text-[11px] text-muted-foreground leading-snug">Con cuánto tiempo antes un cliente puede agendar o cancelar por WhatsApp.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Buffer entre citas (min)</Label>
            <Input type="number" value={bufferMinutes} onChange={(e) => setBufferMinutes(e.target.value)} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Recordatorio de cita (horas antes)</Label>
            <Input type="number" min={1} value={reminderHours} onChange={(e) => setReminderHours(e.target.value)} className="max-w-[8rem]" />
            <p className="text-[11px] text-muted-foreground leading-snug">
              Debe ser mayor que la anticipación mínima, para que el cliente alcance a cancelar a tiempo si no puede ir.
              {Number(reminderHours) <= Number(cancellationHours) && (
                <span className="text-destructive"> Ahora mismo el recordatorio llegaría cuando ya no se puede cancelar.</span>
              )}
            </p>
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "Guardando…" : saved ? "✓ Guardado" : "Guardar"}
        </Button>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarCheck2 size={16} className="text-gold-bright" />
          <h2 className="font-semibold text-sm">Google Calendar</h2>
        </div>
        {googleConnected ? (
          <>
            <p className="text-sm text-muted-foreground">✓ Conectado — cada cita se crea automáticamente en tu calendario.</p>
            <Button variant="outline" size="sm" onClick={disconnectGoogle} disabled={disconnecting}>
              {disconnecting ? "Desconectando…" : "Desconectar"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Conecta tu cuenta de Google para que las citas se guarden solas en tu calendario.</p>
            <Button asChild size="sm">
              <a href="/api/auth/google">Conectar Google Calendar</a>
            </Button>
          </>
        )}
      </Card>

      <Card className="p-4 space-y-2">
        <h2 className="font-semibold text-sm">Conexión de WhatsApp</h2>
        <p className="text-sm text-muted-foreground">
          {business.whatsapp_provider ? `Conectado vía ${PROVIDER_LABEL[business.whatsapp_provider] || business.whatsapp_provider}` : "Todavía no configurada."}
        </p>
      </Card>
    </div>
  )
}
