"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Business } from "@/types/scheduling"

export function AvisosTab() {
  const [business, setBusiness] = useState<Business | null>(null)
  const [rangeStart, setRangeStart] = useState("")
  const [rangeEnd, setRangeEnd] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ affectedCount: number; notified: { clientName: string | null; phone: string }[] } | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/dashboard/business")
      .then((r) => r.json())
      .then((j) => setBusiness(j.business))
  }, [])

  async function send() {
    if (!rangeStart || !rangeEnd || !message) {
      setError("Completa el rango de fechas y el mensaje")
      return
    }
    setSending(true)
    setError("")
    setResult(null)
    const res = await fetch("/api/dashboard/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rangeStart, rangeEnd, message }),
    })
    const json = await res.json()
    setSending(false)
    if (!res.ok) {
      setError(json.error || "Error al enviar el aviso")
      return
    }
    setResult(json)
    setMessage("")
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Si no puedes atender un rango de días, avisa aquí — se les escribe automáticamente a todos los clientes con cita en ese
        rango, ofreciéndoles alternativas para reprogramar. Sus citas quedan marcadas como &quot;por reprogramar&quot;.
      </p>

      {business && !business.whatsapp_provider && (
        <Card className="p-4 border-destructive/40 bg-destructive/10 flex gap-3 items-start">
          <AlertTriangle size={18} className="text-destructive shrink-0 mt-0.5" />
          <p className="text-sm">
            Todavía no hay un proveedor de WhatsApp conectado. Los avisos se van a registrar y las citas se van a marcar
            correctamente, pero el mensaje no se va a entregar de verdad hasta que esté conectado.
          </p>
        </Card>
      )}

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Mensaje para tus clientes</Label>
          <Textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hola, tuve un imprevisto esta semana y no voy a poder atender los turnos agendados. ¡Mil disculpas!"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={send} disabled={sending} className="w-full">
          {sending ? "Enviando…" : "Enviar aviso"}
        </Button>
      </Card>

      {result && (
        <Card className="p-4 space-y-2">
          <p className="text-sm font-semibold">
            {result.affectedCount === 0 ? "No había citas en ese rango." : `Se avisó a ${result.affectedCount} cliente(s):`}
          </p>
          {result.notified.map((n, i) => (
            <p key={i} className="text-sm text-muted-foreground">
              {n.clientName || n.phone}
            </p>
          ))}
        </Card>
      )}
    </div>
  )
}
