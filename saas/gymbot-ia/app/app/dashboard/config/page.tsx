"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { Gym, GymConfig } from "@/lib/supabase"

export default function ConfigPage() {
  const [gym, setGym] = useState<Gym | null>(null)
  const [config, setConfig] = useState<GymConfig>({
    greeting: "",
    hours: "",
    prices: "",
    classes: "",
    location: "",
    contact_name: "",
  })
  const [apiToken, setApiToken] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    async function fetchGym() {
      try {
        const res = await fetch("/api/gyms")
        if (res.ok) {
          const json = await res.json()
          if (json.gym) {
            setGym(json.gym)
            setConfig(json.gym.config || {})
          }
        }
      } finally {
        setLoading(false)
      }
    }
    fetchGym()
  }, [])

  async function handleSave() {
    if (!gym) return
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      const res = await fetch("/api/gyms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: gym.id,
          config,
          apiToken: apiToken || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Error al guardar")
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error inesperado")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#A8FF3E] border-t-transparent" />
      </div>
    )
  }

  if (!gym) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-lg font-bold text-[#F2F0EB] mb-2">Sin gymbot configurado</p>
        <a href="/setup" className="text-[#A8FF3E] hover:underline text-sm">
          Configura uno ahora →
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-[#F2F0EB]">Configuración del bot</h1>
        <p className="text-sm text-[#8B8F8D]">
          Actualiza la información que usa el bot para responder a tus clientes
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-[#FF4444]/30 bg-[#FF4444]/10 px-4 py-3 text-sm text-[#FF4444]">
          {error}
        </div>
      )}

      {saved && (
        <div className="rounded-lg border border-[#A8FF3E]/30 bg-[#A8FF3E]/10 px-4 py-3 text-sm text-[#A8FF3E]">
          ✓ Configuración guardada correctamente
        </div>
      )}

      <div className="rounded-xl border border-[#2A2D2C] bg-[#141716] p-6 space-y-5">
        <h2 className="font-bold text-[#F2F0EB]">Información del gimnasio</h2>
        <div className="space-y-2">
          <Label htmlFor="contact_name">Nombre del contacto principal</Label>
          <Input
            id="contact_name"
            value={config.contact_name}
            onChange={(e) => setConfig({ ...config, contact_name: e.target.value })}
            placeholder="Nombre del dueño o administrador"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Dirección</Label>
          <Input
            id="location"
            value={config.location}
            onChange={(e) => setConfig({ ...config, location: e.target.value })}
            placeholder="Dirección del gimnasio"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="greeting">Saludo inicial del bot</Label>
          <Textarea
            id="greeting"
            value={config.greeting}
            onChange={(e) => setConfig({ ...config, greeting: e.target.value })}
            rows={2}
            placeholder="¡Hola! 👋 Bienvenido..."
          />
        </div>
      </div>

      <div className="rounded-xl border border-[#2A2D2C] bg-[#141716] p-6 space-y-5">
        <h2 className="font-bold text-[#F2F0EB]">Información que responde el bot</h2>
        <div className="space-y-2">
          <Label htmlFor="hours">Horarios</Label>
          <Textarea
            id="hours"
            value={config.hours}
            onChange={(e) => setConfig({ ...config, hours: e.target.value })}
            rows={3}
            placeholder="Lunes a viernes 6am-10pm..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="prices">Precios y membresías</Label>
          <Textarea
            id="prices"
            value={config.prices}
            onChange={(e) => setConfig({ ...config, prices: e.target.value })}
            rows={4}
            placeholder="Mensual $89.000. Trimestral..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="classes">Clases disponibles</Label>
          <Textarea
            id="classes"
            value={config.classes}
            onChange={(e) => setConfig({ ...config, classes: e.target.value })}
            rows={3}
            placeholder="Spinning (L-V 7am, 12pm)..."
          />
        </div>
      </div>

      <div className="rounded-xl border border-[#2A2D2C] bg-[#141716] p-6 space-y-4">
        <h2 className="font-bold text-[#F2F0EB]">Conexión WhatsApp (360Dialog)</h2>
        <div className="rounded-lg bg-[#0D0F0E] p-3 text-sm text-[#8B8F8D]">
          <p className="font-semibold text-[#F2F0EB] mb-1">URL del webhook a configurar en 360Dialog:</p>
          <code className="text-[#A8FF3E] text-xs break-all">
            https://gymbot-ia.vercel.app/api/webhook
          </code>
        </div>
        <div className="space-y-2">
          <Label htmlFor="apiToken">API Key de 360Dialog</Label>
          <Input
            id="apiToken"
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="Pega tu API key aquí para actualizar"
          />
          <p className="text-xs text-[#8B8F8D]">
            Deja en blanco para mantener la actual.{" "}
            {gym.api_token ? (
              <span className="text-[#A8FF3E]">✓ API key configurada</span>
            ) : (
              <span className="text-yellow-500">⚠ No hay API key. El bot no responde por WhatsApp.</span>
            )}
          </p>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? "Guardando..." : "Guardar cambios"}
      </Button>
    </div>
  )
}
