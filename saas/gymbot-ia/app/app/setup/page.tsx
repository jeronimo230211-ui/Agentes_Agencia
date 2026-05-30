"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import type { Provider } from "@/lib/supabase"

type StepOneData = {
  gymName: string
  city: string
  country: string
  contactName: string
  whatsappNumber: string
}

type StepTwoData = {
  hours: string
  prices: string
  classes: string
  location: string
  greeting: string
}

type StepThreeData = {
  provider: Provider
  // 360dialog
  apiToken360: string
  // meta
  accessToken: string
  phoneNumberId: string
  verifyToken: string
  // twilio
  accountSid: string
  authToken: string
  fromNumber: string
}

const COUNTRIES = ["Colombia", "Argentina", "México", "Chile", "Perú", "Uruguay", "Otro"]

const PROVIDERS = [
  {
    id: "meta" as Provider,
    name: "Meta Cloud API",
    badge: "Recomendado",
    badgeColor: "bg-[#A8FF3E] text-[#0D0F0E]",
    icon: "💬",
    price: "Gratis",
    priceDetail: "hasta 1,000 conversaciones/mes",
    pros: ["Sin costo mensual", "Directo con Meta (oficial)", "Escala sin límite"],
    cons: ["Setup requiere cuenta de Facebook Business (~20 min)"],
    setup: "Cuenta de Facebook Business + número verificado",
  },
  {
    id: "360dialog" as Provider,
    name: "360Dialog",
    badge: "Más fácil",
    badgeColor: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
    icon: "🔵",
    price: "$15 USD/mes",
    priceDetail: "por número conectado",
    pros: ["Setup más rápido (~10 min)", "Soporte dedicado", "Panel de control incluido"],
    cons: ["Costo mensual fijo por gymbot"],
    setup: "Solo crear cuenta en 360dialog.com y conectar el número",
  },
  {
    id: "twilio" as Provider,
    name: "Twilio",
    badge: "Pago por uso",
    badgeColor: "bg-red-500/20 text-red-400 border border-red-500/30",
    icon: "🔴",
    price: "$0.005 USD",
    priceDetail: "por conversación",
    pros: ["Sin mensualidad fija", "Ideal si reciben pocos mensajes", "Muy confiable"],
    cons: ["Precio sube con volumen alto", "Setup técnico intermedio (~15 min)"],
    setup: "Cuenta en twilio.com + número de WhatsApp Business",
  },
]

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [stepOne, setStepOne] = useState<StepOneData>({
    gymName: "",
    city: "",
    country: "Colombia",
    contactName: "",
    whatsappNumber: "",
  })

  const [stepTwo, setStepTwo] = useState<StepTwoData>({
    hours: "",
    prices: "",
    classes: "",
    location: "",
    greeting: "",
  })

  const [stepThree, setStepThree] = useState<StepThreeData>({
    provider: "meta",
    apiToken360: "",
    accessToken: "",
    phoneNumberId: "",
    verifyToken: "",
    accountSid: "",
    authToken: "",
    fromNumber: "",
  })

  const [gymId, setGymId] = useState<string | null>(null)

  function handleStepOneNext() {
    if (!stepOne.gymName || !stepOne.whatsappNumber || !stepOne.contactName) {
      setError("Por favor completa todos los campos obligatorios.")
      return
    }
    setError("")
    setStep(2)
  }

  function handleStepTwoNext() {
    if (!stepTwo.hours || !stepTwo.prices) {
      setError("Horarios y precios son obligatorios para que el bot responda correctamente.")
      return
    }
    setError("")
    setStep(3)
  }

  async function handleComplete() {
    setLoading(true)
    setError("")

    const providerConfig = buildProviderConfig()

    try {
      const res = await fetch("/api/gyms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: stepOne.gymName,
          city: stepOne.city,
          country: stepOne.country,
          contactName: stepOne.contactName,
          whatsappNumber: stepOne.whatsappNumber,
          provider: stepThree.provider,
          providerConfig,
          config: {
            greeting:
              stepTwo.greeting ||
              `¡Hola! 👋 Bienvenido a ${stepOne.gymName}. ¿En qué te puedo ayudar?`,
            hours: stepTwo.hours,
            prices: stepTwo.prices,
            classes: stepTwo.classes || "Consultar disponibilidad",
            location: stepTwo.location || stepOne.city,
            contact_name: stepOne.contactName,
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Error al crear el gymbot")
      }

      const data = await res.json()
      setGymId(data.id)
      setStep(4)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error inesperado")
    } finally {
      setLoading(false)
    }
  }

  function buildProviderConfig(): Record<string, string> {
    if (stepThree.provider === "360dialog") return { api_token: stepThree.apiToken360 }
    if (stepThree.provider === "meta")
      return {
        access_token: stepThree.accessToken,
        phone_number_id: stepThree.phoneNumberId,
        verify_token: stepThree.verifyToken || crypto.randomUUID().slice(0, 16),
      }
    if (stepThree.provider === "twilio")
      return {
        account_sid: stepThree.accountSid,
        auth_token: stepThree.authToken,
        from_number: stepThree.fromNumber,
      }
    return {}
  }

  const webhookUrl = "https://agentes-agencia.vercel.app/api/webhook"
  const selectedProvider = PROVIDERS.find((p) => p.id === stepThree.provider)!

  return (
    <div className="min-h-screen bg-[#0D0F0E] px-4 py-12">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-10 text-center">
          <Link href="/" className="mb-6 inline-flex items-center gap-2">
            <span className="text-xl font-black text-[#F2F0EB]">GymBot</span>
            <span className="rounded-md bg-[#A8FF3E] px-1.5 py-0.5 text-xs font-bold text-[#0D0F0E]">IA</span>
          </Link>
          {step < 4 && (
            <>
              <h1 className="mt-4 text-3xl font-black text-[#F2F0EB]">Configura tu GymBot</h1>
              <p className="mt-2 text-[#8B8F8D]">En 10 minutos tu gimnasio responde solo en WhatsApp</p>
            </>
          )}
        </div>

        {/* Progress */}
        {step < 4 && (
          <>
            <div className="mb-4 flex items-center gap-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                      s <= step ? "bg-[#A8FF3E] text-[#0D0F0E]" : "border border-[#2A2D2C] text-[#8B8F8D]"
                    }`}
                  >
                    {s < step ? "✓" : s}
                  </div>
                  {s < 3 && <div className={`h-0.5 flex-1 transition-colors ${s < step ? "bg-[#A8FF3E]" : "bg-[#2A2D2C]"}`} />}
                </div>
              ))}
            </div>
            <div className="mb-8 flex text-xs text-[#8B8F8D]">
              <span className={`flex-1 ${step === 1 ? "text-[#A8FF3E]" : ""}`}>Tu gimnasio</span>
              <span className={`flex-1 text-center ${step === 2 ? "text-[#A8FF3E]" : ""}`}>Info del bot</span>
              <span className={`flex-1 text-right ${step === 3 ? "text-[#A8FF3E]" : ""}`}>WhatsApp</span>
            </div>
          </>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-[#FF4444]/30 bg-[#FF4444]/10 px-4 py-3 text-sm text-[#FF4444]">
            {error}
          </div>
        )}

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div className="space-y-5 rounded-xl border border-[#2A2D2C] bg-[#141716] p-6">
            <div className="space-y-2">
              <Label htmlFor="gymName">Nombre del gimnasio <span className="text-[#FF4444]">*</span></Label>
              <Input id="gymName" placeholder="Ej: Total Fit Gym" value={stepOne.gymName}
                onChange={(e) => setStepOne({ ...stepOne, gymName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Ciudad</Label>
                <Input id="city" placeholder="Ej: Medellín" value={stepOne.city}
                  onChange={(e) => setStepOne({ ...stepOne, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">País</Label>
                <select id="country" value={stepOne.country}
                  onChange={(e) => setStepOne({ ...stepOne, country: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-[#2A2D2C] bg-[#1A1D1C] px-3 py-2 text-sm text-[#F2F0EB] focus:outline-none focus:ring-2 focus:ring-[#A8FF3E]">
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">Tu nombre <span className="text-[#FF4444]">*</span></Label>
              <Input id="contactName" placeholder="Ej: Carlos Rodríguez" value={stepOne.contactName}
                onChange={(e) => setStepOne({ ...stepOne, contactName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">Número de WhatsApp <span className="text-[#FF4444]">*</span></Label>
              <Input id="whatsapp" placeholder="Ej: +57 3001234567" value={stepOne.whatsappNumber}
                onChange={(e) => setStepOne({ ...stepOne, whatsappNumber: e.target.value })} />
            </div>
            <Button className="w-full" onClick={handleStepOneNext}>Continuar →</Button>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div className="space-y-5 rounded-xl border border-[#2A2D2C] bg-[#141716] p-6">
            <div className="space-y-2">
              <Label htmlFor="hours">Horarios <span className="text-[#FF4444]">*</span></Label>
              <Textarea id="hours" rows={3} placeholder="Lunes a viernes 6am-10pm. Sábados 7am-8pm."
                value={stepTwo.hours} onChange={(e) => setStepTwo({ ...stepTwo, hours: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prices">Precios y membresías <span className="text-[#FF4444]">*</span></Label>
              <Textarea id="prices" rows={4} placeholder="Mensual $89.000. Trimestral $240.000."
                value={stepTwo.prices} onChange={(e) => setStepTwo({ ...stepTwo, prices: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classes">Clases disponibles</Label>
              <Textarea id="classes" rows={3} placeholder="Spinning (L-V 7am), Yoga (Ma-Ju 8am)..."
                value={stepTwo.classes} onChange={(e) => setStepTwo({ ...stepTwo, classes: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Dirección</Label>
              <Input id="location" placeholder="Calle 63 #80a-134, Laureles"
                value={stepTwo.location} onChange={(e) => setStepTwo({ ...stepTwo, location: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="greeting">Saludo inicial del bot</Label>
              <Textarea id="greeting" rows={2} placeholder={`¡Hola! 👋 Bienvenido a ${stepOne.gymName || "nuestro gym"}...`}
                value={stepTwo.greeting} onChange={(e) => setStepTwo({ ...stepTwo, greeting: e.target.value })} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>← Atrás</Button>
              <Button className="flex-1" onClick={handleStepTwoNext}>Continuar →</Button>
            </div>
          </div>
        )}

        {/* ── Step 3 — Provider selector ── */}
        {step === 3 && (
          <div className="space-y-5">
            {/* Provider cards */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[#F2F0EB]">
                Elige cómo conectar WhatsApp
              </p>
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setStepThree({ ...stepThree, provider: p.id })}
                  className={`w-full rounded-xl border p-4 text-left transition-all ${
                    stepThree.provider === p.id
                      ? "border-[#A8FF3E] bg-[#A8FF3E]/5"
                      : "border-[#2A2D2C] bg-[#141716] hover:border-[#3A3D3C]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{p.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#F2F0EB]">{p.name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.badgeColor}`}>
                            {p.badge}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-baseline gap-1">
                          <span className="text-sm font-bold text-[#A8FF3E]">{p.price}</span>
                          <span className="text-xs text-[#8B8F8D]">{p.priceDetail}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${
                      stepThree.provider === p.id ? "border-[#A8FF3E] bg-[#A8FF3E]" : "border-[#2A2D2C]"
                    }`} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    {p.pros.map((pro) => (
                      <div key={pro} className="flex items-start gap-1 text-[#8B8F8D]">
                        <span className="text-[#A8FF3E] shrink-0">✓</span> {pro}
                      </div>
                    ))}
                    {p.cons.map((con) => (
                      <div key={con} className="flex items-start gap-1 text-[#8B8F8D]">
                        <span className="text-yellow-500 shrink-0">→</span> {con}
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            {/* Provider-specific fields */}
            <div className="rounded-xl border border-[#2A2D2C] bg-[#141716] p-5 space-y-4">
              <div className="rounded-lg bg-[#0D0F0E] p-3">
                <p className="text-xs font-semibold text-[#8B8F8D] mb-1">URL del webhook (copiar en {selectedProvider.name})</p>
                <code className="text-xs text-[#A8FF3E] break-all">{webhookUrl}</code>
              </div>

              {stepThree.provider === "360dialog" && (
                <>
                  <div className="text-xs text-[#8B8F8D] space-y-1">
                    <p className="font-semibold text-[#F2F0EB]">Pasos:</p>
                    <p>1. Crea cuenta en <span className="text-[#A8FF3E]">360dialog.com</span></p>
                    <p>2. Conecta tu número de WhatsApp Business</p>
                    <p>3. Copia tu API Key y pégala abajo</p>
                    <p>4. En 360Dialog configura el webhook URL de arriba</p>
                  </div>
                  <div className="space-y-2">
                    <Label>API Key de 360Dialog <span className="text-[#8B8F8D] font-normal">(opcional, puedes agregar después)</span></Label>
                    <Input type="password" placeholder="Tu API key de 360Dialog"
                      value={stepThree.apiToken360}
                      onChange={(e) => setStepThree({ ...stepThree, apiToken360: e.target.value })} />
                  </div>
                </>
              )}

              {stepThree.provider === "meta" && (
                <>
                  <div className="text-xs text-[#8B8F8D] space-y-1">
                    <p className="font-semibold text-[#F2F0EB]">Pasos:</p>
                    <p>1. Ve a <span className="text-[#A8FF3E]">developers.facebook.com</span> → crear app</p>
                    <p>2. Agrega el producto "WhatsApp" → obtén el Phone Number ID y Access Token</p>
                    <p>3. En Webhooks, usa la URL de arriba y el Verify Token que elijas abajo</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Access Token <span className="text-[#8B8F8D] font-normal">(opcional)</span></Label>
                    <Input type="password" placeholder="EAABx..." value={stepThree.accessToken}
                      onChange={(e) => setStepThree({ ...stepThree, accessToken: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number ID <span className="text-[#8B8F8D] font-normal">(opcional)</span></Label>
                    <Input placeholder="123456789012345" value={stepThree.phoneNumberId}
                      onChange={(e) => setStepThree({ ...stepThree, phoneNumberId: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Verify Token <span className="text-[#8B8F8D] font-normal">(inventar uno, ej: gymbot-abc123)</span></Label>
                    <Input placeholder="gymbot-mi-gym-123" value={stepThree.verifyToken}
                      onChange={(e) => setStepThree({ ...stepThree, verifyToken: e.target.value })} />
                  </div>
                </>
              )}

              {stepThree.provider === "twilio" && (
                <>
                  <div className="text-xs text-[#8B8F8D] space-y-1">
                    <p className="font-semibold text-[#F2F0EB]">Pasos:</p>
                    <p>1. Crea cuenta en <span className="text-[#A8FF3E]">twilio.com</span></p>
                    <p>2. Activa WhatsApp Sandbox o compra un número WhatsApp</p>
                    <p>3. En el Sandbox/número, configura el webhook URL de arriba</p>
                    <p>4. Copia Account SID y Auth Token del dashboard</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Account SID <span className="text-[#8B8F8D] font-normal">(opcional)</span></Label>
                    <Input placeholder="ACxxxxxxxxxxxxxxxx" value={stepThree.accountSid}
                      onChange={(e) => setStepThree({ ...stepThree, accountSid: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Auth Token <span className="text-[#8B8F8D] font-normal">(opcional)</span></Label>
                    <Input type="password" placeholder="Tu auth token de Twilio" value={stepThree.authToken}
                      onChange={(e) => setStepThree({ ...stepThree, authToken: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Número From <span className="text-[#8B8F8D] font-normal">(opcional)</span></Label>
                    <Input placeholder="whatsapp:+14155238886" value={stepThree.fromNumber}
                      onChange={(e) => setStepThree({ ...stepThree, fromNumber: e.target.value })} />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>← Atrás</Button>
              <Button className="flex-1" onClick={handleComplete} disabled={loading}>
                {loading ? "Creando tu bot..." : "Activar GymBot ✓"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4 — Success ── */}
        {step === 4 && (
          <div className="rounded-xl border border-[#A8FF3E]/30 bg-[#141716] p-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#A8FF3E]/20 text-3xl">🎉</div>
            <h2 className="mb-2 text-2xl font-black text-[#F2F0EB]">¡Tu GymBot está listo!</h2>
            <p className="mb-6 text-[#8B8F8D]">
              {stepOne.gymName} tiene su asistente de WhatsApp configurado con{" "}
              <span className="text-[#F2F0EB] font-semibold">{selectedProvider.name}</span>.
              En cuanto conectes las credenciales, empezará a responder solo.
            </p>
            <div className="mb-6 rounded-lg bg-[#0D0F0E] p-4 text-left">
              <p className="mb-2 text-xs font-semibold text-[#8B8F8D] uppercase tracking-wider">Próximos pasos</p>
              <ul className="space-y-2 text-sm text-[#F2F0EB]">
                <li className="flex items-start gap-2"><span className="text-[#A8FF3E]">1.</span> Conecta {selectedProvider.name} con tu número WhatsApp</li>
                <li className="flex items-start gap-2"><span className="text-[#A8FF3E]">2.</span> Agrega tus credenciales en Panel → Configuración</li>
                <li className="flex items-start gap-2"><span className="text-[#A8FF3E]">3.</span> Envía un mensaje de prueba para verificar</li>
              </ul>
            </div>
            <Button className="w-full" onClick={() => router.push(gymId ? `/dashboard?gym=${gymId}` : "/dashboard")}>
              Ir a mi panel →
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
