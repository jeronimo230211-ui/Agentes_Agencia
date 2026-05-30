import Link from "next/link"

const steps = [
  {
    num: "01",
    title: "Configura tu gimnasio",
    desc: "Cuéntanos los horarios, precios y clases. En 10 minutos tu bot está listo.",
  },
  {
    num: "02",
    title: "Conecta WhatsApp",
    desc: "Vinculas tu número de WhatsApp Business y el bot empieza a responder solo.",
  },
  {
    num: "03",
    title: "Captura leads automáticamente",
    desc: "El bot identifica interesados, obtiene sus datos y te los envía en tiempo real.",
  },
]

const plans = [
  {
    name: "Piloto",
    price: "$49",
    period: "/mes",
    setup: "Setup gratis",
    desc: "Para los primeros 5 gimnasios",
    features: [
      "Bot WhatsApp 24/7",
      "Captura de leads automática",
      "Dashboard de conversaciones",
      "Soporte directo por WhatsApp",
    ],
    cta: "Empezar gratis",
    highlight: false,
  },
  {
    name: "Esencial",
    price: "$79",
    period: "/mes",
    setup: "Setup $150",
    desc: "El más popular",
    features: [
      "Todo del plan Piloto",
      "Respuestas ilimitadas",
      "Panel de leads con filtros",
      "Actualización de precios/horarios",
    ],
    cta: "Comenzar ahora",
    highlight: true,
  },
  {
    name: "Pro",
    price: "$149",
    period: "/mes",
    setup: "Setup $150",
    desc: "Para gimnasios en crecimiento",
    features: [
      "Todo del plan Esencial",
      "Reporte semanal por email (IA)",
      "Múltiples bots por sucursal",
      "Análisis de conversaciones",
    ],
    cta: "Comenzar ahora",
    highlight: false,
  },
]

const testimonials = [
  {
    text: "Antes respondía WhatsApp 3 horas al día. Ahora el bot lo hace y yo me enfoco en entrenar a mis clientes.",
    name: "Carlos M.",
    gym: "Hakuna CrossFit, Envigado",
  },
  {
    text: "La primera semana capturó 8 leads que yo habría perdido por no responder a tiempo. Ya tenemos 3 nuevos inscritos.",
    name: "Andrea L.",
    gym: "Sport Club, Medellín",
  },
  {
    text: "Lo configuramos en una tarde. Mis recepcionistas ya no pierden tiempo con las mismas preguntas de siempre.",
    name: "Roberto G.",
    gym: "Gimnasio XXL, Buenos Aires",
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0D0F0E]">
      {/* Nav */}
      <nav className="border-b border-[#2A2D2C] px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-[#F2F0EB]">GymBot</span>
            <span className="rounded-md bg-[#A8FF3E] px-1.5 py-0.5 text-xs font-bold text-[#0D0F0E]">
              IA
            </span>
          </div>
          <div className="hidden items-center gap-8 text-sm text-[#8B8F8D] md:flex">
            <a href="#como-funciona" className="hover:text-[#F2F0EB] transition-colors">
              Cómo funciona
            </a>
            <a href="#precios" className="hover:text-[#F2F0EB] transition-colors">
              Precios
            </a>
            <Link
              href="/dashboard"
              className="text-[#F2F0EB] hover:text-[#A8FF3E] transition-colors"
            >
              Mi panel
            </Link>
          </div>
          <Link
            href="/setup"
            className="rounded-lg bg-[#A8FF3E] px-4 py-2 text-sm font-bold text-[#0D0F0E] hover:bg-[#8FE62A] transition-colors"
          >
            Comenzar gratis
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-4 py-24 text-center md:py-32">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#A8FF3E]/30 bg-[#A8FF3E]/10 px-4 py-1.5 text-sm text-[#A8FF3E]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#A8FF3E] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#A8FF3E]" />
            </span>
            Más de 30 gimnasios en LATAM ya automatizados
          </div>
          <h1 className="mb-6 text-5xl font-black leading-tight tracking-tight text-[#F2F0EB] md:text-7xl">
            Tu gimnasio responde{" "}
            <span className="text-[#A8FF3E]">solo en WhatsApp.</span>
            <br />
            24/7.
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-xl text-[#8B8F8D] leading-relaxed">
            Para de perder leads por no responder a tiempo. GymBot IA atiende a tus clientes
            potenciales automáticamente, captura sus datos y te avisa cuando hay un interesado
            listo para inscribirse.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/setup"
              className="w-full rounded-xl bg-[#A8FF3E] px-8 py-4 text-lg font-bold text-[#0D0F0E] hover:bg-[#8FE62A] transition-colors sm:w-auto"
            >
              Configurar mi gymbot ahora →
            </Link>
            <p className="text-sm text-[#8B8F8D]">Sin tarjeta. En 24 horas tu bot está activo.</p>
          </div>
        </div>
      </section>

      {/* Chat mockup */}
      <section className="px-4 pb-20">
        <div className="mx-auto max-w-sm">
          <div className="rounded-2xl border border-[#2A2D2C] bg-[#141716] overflow-hidden">
            <div className="flex items-center gap-3 border-b border-[#2A2D2C] bg-[#1A1D1C] px-4 py-3">
              <div className="h-9 w-9 rounded-full bg-[#A8FF3E] flex items-center justify-center text-[#0D0F0E] font-bold text-sm">
                GYM
              </div>
              <div>
                <p className="text-sm font-semibold text-[#F2F0EB]">Total Fit Gym</p>
                <p className="text-xs text-[#A8FF3E]">● En línea</p>
              </div>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex justify-end">
                <div className="rounded-2xl rounded-tr-sm bg-[#2A2D2C] px-3 py-2 text-sm text-[#F2F0EB] max-w-[80%]">
                  Hola! ¿cuánto cuesta la membresía?
                </div>
              </div>
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-[#A8FF3E]/15 border border-[#A8FF3E]/20 px-3 py-2 text-sm text-[#F2F0EB] max-w-[80%]">
                  ¡Hola! 💪 Tenemos 3 opciones:
                  <br />• Mensual: $89.000
                  <br />• Trimestral: $240.000
                  <br />• Anual: $800.000
                  <br />
                  <br />¿Te interesa conocer el gym? ¿Me dices tu nombre para coordinar una visita?
                </div>
              </div>
              <div className="flex justify-end">
                <div className="rounded-2xl rounded-tr-sm bg-[#2A2D2C] px-3 py-2 text-sm text-[#F2F0EB] max-w-[80%]">
                  Soy Sebastián, sí me interesa
                </div>
              </div>
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-[#A8FF3E]/15 border border-[#A8FF3E]/20 px-3 py-2 text-sm text-[#F2F0EB] max-w-[80%]">
                  Perfecto Sebastián! 🙌 ¿A qué número te llamamos para coordinar? El equipo se
                  comunica contigo hoy mismo.
                </div>
              </div>
            </div>
            <div className="border-t border-[#2A2D2C] px-4 py-2 text-center text-xs text-[#8B8F8D]">
              ⚡ Respondido en 2 segundos por GymBot IA
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-black text-[#F2F0EB]">
              Configurado en{" "}
              <span className="text-[#A8FF3E]">24 horas.</span>
            </h2>
            <p className="text-lg text-[#8B8F8D]">
              Sin técnicos. Sin código. Solo llenas un formulario.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.num}
                className="rounded-xl border border-[#2A2D2C] bg-[#141716] p-6"
              >
                <div className="mb-4 text-4xl font-black text-[#A8FF3E]">{step.num}</div>
                <h3 className="mb-2 text-xl font-bold text-[#F2F0EB]">{step.title}</h3>
                <p className="text-[#8B8F8D] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-4 py-20 bg-[#141716]">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-4xl font-black text-[#F2F0EB]">
            Gimnasios que ya dejaron de perder leads
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <div key={i} className="rounded-xl border border-[#2A2D2C] bg-[#0D0F0E] p-6">
                <p className="mb-4 text-[#F2F0EB] leading-relaxed">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-[#F2F0EB]">{t.name}</p>
                  <p className="text-sm text-[#8B8F8D]">{t.gym}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="precios" className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-black text-[#F2F0EB]">
              Precios simples. Sin sorpresas.
            </h2>
            <p className="text-lg text-[#8B8F8D]">
              Los primeros 5 gimnasios pagan $49/mes en lugar de $79. Sin costo de setup.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-xl border p-6 ${
                  plan.highlight
                    ? "border-[#A8FF3E] bg-[#141716]"
                    : "border-[#2A2D2C] bg-[#141716]"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#A8FF3E] px-3 py-0.5 text-xs font-bold text-[#0D0F0E]">
                    MÁS POPULAR
                  </div>
                )}
                <div className="mb-6">
                  <p className="mb-1 text-sm font-semibold text-[#8B8F8D] uppercase tracking-wider">
                    {plan.name}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-[#F2F0EB]">{plan.price}</span>
                    <span className="text-[#8B8F8D]">{plan.period}</span>
                  </div>
                  <p className="mt-1 text-sm text-[#8B8F8D]">{plan.setup}</p>
                </div>
                <ul className="mb-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[#F2F0EB]">
                      <span className="mt-0.5 text-[#A8FF3E]">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/setup"
                  className={`block w-full rounded-lg py-3 text-center text-sm font-bold transition-colors ${
                    plan.highlight
                      ? "bg-[#A8FF3E] text-[#0D0F0E] hover:bg-[#8FE62A]"
                      : "border border-[#2A2D2C] text-[#F2F0EB] hover:border-[#A8FF3E] hover:text-[#A8FF3E]"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-4 py-24 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-4 text-4xl font-black text-[#F2F0EB]">
            ¿Cuántos leads perdiste hoy por no responder a tiempo?
          </h2>
          <p className="mb-8 text-lg text-[#8B8F8D]">
            Cada mensaje sin respuesta en menos de 5 minutos es un cliente que se va a la competencia.
          </p>
          <Link
            href="/setup"
            className="inline-block rounded-xl bg-[#A8FF3E] px-10 py-4 text-lg font-bold text-[#0D0F0E] hover:bg-[#8FE62A] transition-colors"
          >
            Activar mi GymBot ahora →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2A2D2C] px-4 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-sm text-[#8B8F8D]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#F2F0EB]">GymBot IA</span>
            <span className="text-[#2A2D2C]">|</span>
            <span>by Nexora IA</span>
          </div>
          <div className="flex gap-6">
            <Link href="/setup" className="hover:text-[#F2F0EB] transition-colors">
              Comenzar
            </Link>
            <Link href="/dashboard" className="hover:text-[#F2F0EB] transition-colors">
              Mi panel
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
