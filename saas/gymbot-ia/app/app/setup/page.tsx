"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import Link from "next/link"

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
  apiToken: string
}

const COUNTRIES = ["Colombia", "Argentina", "México", "Chile", "Perú", "Uruguay", "Otro"]

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
    apiToken: "",
  })

  const [gymId, setGymId] = useState<string | null>(null)

  async function handleStepOneNext() {
    if (!stepOne.gymName || !stepOne.whatsappNumber || !stepOne.contactName) {
      setError("Por favor completa todos los campos obligatorios.")
      return
    }
    setError("")
    setStep(2)
  }

  async function handleStepTwoNext() {
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
          apiToken: stepThree.apiToken || null,
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

  return (
    <div className="min-h-screen bg-[#0D0F0E] px-4 py-12">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-10 text-center">
          <Link href="/" className="mb-6 inline-flex items-center gap-2">
            <span className="text-xl font-black text-[#F2F0EB]">GymBot</span>
            <span className="rounded-md bg-[#A8FF3E] px-1.5 py-0.5 text-xs font-bold text-[#0D0F0E]">
              IA
            </span>
          </Link>
          {step < 4 && (
            <>
              <h1 className="mt-4 text-3xl font-black text-[#F2F0EB]">
                Configura tu GymBot
              </h1>
              <p className="mt-2 text-[#8B8F8D]">
                En 10 minutos tu gimnasio responde solo en WhatsApp
              </p>
            </>
          )}
        </div>

        {/* Progress */}
        {step < 4 && (
          <div className="mb-8 flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    s <= step
                      ? "bg-[#A8FF3E] text-[#0D0F0E]"
                      : "border border-[#2A2D2C] text-[#8B8F8D]"
                  }`}
                >
                  {s < step ? "✓" : s}
                </div>
                {s < 3 && (
                  <div
                    className={`h-0.5 flex-1 transition-colors ${
                      s < step ? "bg-[#A8FF3E]" : "bg-[#2A2D2C]"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step labels */}
        {step < 4 && (
          <div className="mb-8 flex text-xs text-[#8B8F8D]">
            <span className={`flex-1 ${step === 1 ? "text-[#A8FF3E]" : ""}`}>Tu gimnasio</span>
            <span className={`flex-1 text-center ${step === 2 ? "text-[#A8FF3E]" : ""}`}>
              Info del bot
            </span>
            <span className={`flex-1 text-right ${step === 3 ? "text-[#A8FF3E]" : ""}`}>
              WhatsApp
            </span>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-[#FF4444]/30 bg-[#FF4444]/10 px-4 py-3 text-sm text-[#FF4444]">
            {error}
          </div>
        )}

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-5 rounded-xl border border-[#2A2D2C] bg-[#141716] p-6">
            <div className="space-y-2">
              <Label htmlFor="gymName">
                Nombre del gimnasio <span className="text-[#FF4444]">*</span>
              </Label>
              <Input
                id="gymName"
                placeholder="Ej: Total Fit Gym"
                value={stepOne.gymName}
                onChange={(e) => setStepOne({ ...stepOne, gymName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Ciudad</Label>
                <Input
                  id="city"
                  placeholder="Ej: Medellín"
                  value={stepOne.city}
                  onChange={(e) => setStepOne({ ...stepOne, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">País</Label>
                <select
                  id="country"
                  value={stepOne.country}
                  onChange={(e) => setStepOne({ ...stepOne, country: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-[#2A2D2C] bg-[#1A1D1C] px-3 py-2 text-sm text-[#F2F0EB] focus:outline-none focus:ring-2 focus:ring-[#A8FF3E]"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">
                Tu nombre (dueño o administrador) <span className="text-[#FF4444]">*</span>
              </Label>
              <Input
                id="contactName"
                placeholder="Ej: Carlos Rodríguez"
                value={stepOne.contactName}
                onChange={(e) => setStepOne({ ...stepOne, contactName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">
                Número de WhatsApp Business <span className="text-[#FF4444]">*</span>
              </Label>
              <Input
                id="whatsapp"
                placeholder="Ej: +57 3001234567"
                value={stepOne.whatsappNumber}
                onChange={(e) => setStepOne({ ...stepOne, whatsappNumber: e.target.value })}
              />
              <p className="text-xs text-[#8B8F8D]">
                El número que ya usan para atención al cliente
              </p>
            </div>
            <Button className="w-full" onClick={handleStepOneNext}>
              Continuar →
            </Button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-5 rounded-xl border border-[#2A2D2C] bg-[#141716] p-6">
            <div className="space-y-2">
              <Label htmlFor="hours">
                Horarios de atención <span className="text-[#FF4444]">*</span>
              </Label>
              <Textarea
                id="hours"
                placeholder="Ej: Lunes a viernes 6am-10pm. Sábados 7am-8pm. Domingos 8am-2pm."
                value={stepTwo.hours}
                onChange={(e) => setStepTwo({ ...stepTwo, hours: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prices">
                Precios y membresías <span className="text-[#FF4444]">*</span>
              </Label>
              <Textarea
                id="prices"
                placeholder="Ej: Mensual $89.000. Trimestral $240.000 (ahorra 10%). Anual $800.000 (ahorra 25%). Incluye acceso a todas las clases grupales."
                value={stepTwo.prices}
                onChange={(e) => setStepTwo({ ...stepTwo, prices: e.target.value })}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classes">Clases disponibles</Label>
              <Textarea
                id="classes"
                placeholder="Ej: Spinning (L-V 7am, 12pm, 6pm), Yoga (Ma-Ju 8am, 7pm), CrossFit (todos los días 6am y 7pm), Zumba (Lu-Mi-Vi 5pm)."
                value={stepTwo.classes}
                onChange={(e) => setStepTwo({ ...stepTwo, classes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Dirección o zona</Label>
              <Input
                id="location"
                placeholder="Ej: Calle 63 #80a-134, Laureles, Medellín"
                value={stepTwo.location}
                onChange={(e) => setStepTwo({ ...stepTwo, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="greeting">Saludo inicial del bot</Label>
              <Textarea
                id="greeting"
                placeholder={`Ej: ¡Hola! 👋 Bienvenido a ${stepOne.gymName || "nuestro gimnasio"}. Soy el asistente virtual. ¿En qué te puedo ayudar?`}
                value={stepTwo.greeting}
                onChange={(e) => setStepTwo({ ...stepTwo, greeting: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                ← Atrás
              </Button>
              <Button className="flex-1" onClick={handleStepTwoNext}>
                Continuar →
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-5 rounded-xl border border-[#2A2D2C] bg-[#141716] p-6">
            <div className="rounded-lg border border-[#A8FF3E]/20 bg-[#A8FF3E]/5 p-4">
              <p className="text-sm font-semibold text-[#A8FF3E] mb-2">
                ¿Cómo conectar WhatsApp?
              </p>
              <ol className="space-y-1 text-sm text-[#F2F0EB] list-decimal list-inside">
                <li>Ve a 360dialog.com y crea una cuenta gratis</li>
                <li>Conecta tu número de WhatsApp Business</li>
                <li>Copia tu API Key y pégala abajo</li>
                <li>En el webhook URL de 360Dialog, pon:</li>
              </ol>
              <div className="mt-2 rounded bg-[#0D0F0E] px-3 py-2 text-xs text-[#A8FF3E] font-mono break-all">
                https://gymbot-ia.vercel.app/api/webhook
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiToken">
                API Key de 360Dialog{" "}
                <span className="text-[#8B8F8D] font-normal">(opcional — puedes agregarlo después)</span>
              </Label>
              <Input
                id="apiToken"
                type="password"
                placeholder="Tu API key de 360Dialog"
                value={stepThree.apiToken}
                onChange={(e) => setStepThree({ apiToken: e.target.value })}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                ← Atrás
              </Button>
              <Button className="flex-1" onClick={handleComplete} disabled={loading}>
                {loading ? "Creando tu bot..." : "Activar GymBot ✓"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4 — Success */}
        {step === 4 && (
          <div className="rounded-xl border border-[#A8FF3E]/30 bg-[#141716] p-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#A8FF3E]/20 text-3xl">
              🎉
            </div>
            <h2 className="mb-2 text-2xl font-black text-[#F2F0EB]">
              ¡Tu GymBot está listo!
            </h2>
            <p className="mb-6 text-[#8B8F8D]">
              {stepOne.gymName} ya tiene su asistente virtual de WhatsApp configurado. En cuanto
              conectes el número de 360Dialog, comenzará a responder solo.
            </p>
            <div className="mb-6 rounded-lg bg-[#0D0F0E] p-4 text-left">
              <p className="mb-1 text-xs font-semibold text-[#8B8F8D] uppercase tracking-wider">
                Próximos pasos
              </p>
              <ul className="space-y-2 text-sm text-[#F2F0EB]">
                <li className="flex items-start gap-2">
                  <span className="text-[#A8FF3E]">1.</span>
                  Conecta 360Dialog con tu número WhatsApp Business
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#A8FF3E]">2.</span>
                  Agrega tu API key en Panel → Configuración
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#A8FF3E]">3.</span>
                  Envía un mensaje de prueba al número para verificar
                </li>
              </ul>
            </div>
            <Button
              className="w-full"
              onClick={() => router.push(gymId ? `/dashboard?gym=${gymId}` : "/dashboard")}
            >
              Ir a mi panel →
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
