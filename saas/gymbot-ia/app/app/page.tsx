import Link from "next/link"
import { FadeIn } from "@/components/fade-in"
import { MobileNav } from "@/components/mobile-nav"

const stats = [
  { value: "30+", label: "Gimnasios en LATAM" },
  { value: "3.000+", label: "Leads capturados" },
  { value: "2s", label: "Respuesta promedio" },
]

const steps = [
  {
    num: "01",
    title: "Configura tu gimnasio",
    desc: "Cuéntanos los horarios, precios y clases. En 10 minutos tu bot ya sabe todo sobre tu negocio.",
  },
  {
    num: "02",
    title: "Conecta WhatsApp",
    desc: "Vinculas tu número de WhatsApp Business y el bot empieza a responder solo. Sin apps extra.",
  },
  {
    num: "03",
    title: "Captura leads sin parar",
    desc: "El bot identifica interesados, obtiene sus datos de contacto y te los envía en tiempo real.",
  },
]

const plans = [
  {
    name: "Piloto",
    price: "$49",
    period: "/mes",
    note: "Setup gratis · Para los primeros 5 gimnasios",
    features: [
      "Bot WhatsApp 24/7",
      "Captura de leads automatica",
      "Dashboard de conversaciones",
      "Soporte directo por WhatsApp",
    ],
    cta: "Empezar ahora",
    highlight: false,
  },
  {
    name: "Esencial",
    price: "$79",
    period: "/mes",
    note: "Setup $150",
    features: [
      "Todo del plan Piloto",
      "Respuestas ilimitadas",
      "Panel de leads con filtros",
      "Actualizacion de precios/horarios",
    ],
    cta: "Empezar ahora",
    highlight: true,
  },
  {
    name: "Pro",
    price: "$149",
    period: "/mes",
    note: "Setup $150",
    features: [
      "Todo del plan Esencial",
      "Reporte semanal por email (IA)",
      "Multiples bots por sucursal",
      "Analisis de conversaciones",
    ],
    cta: "Empezar ahora",
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

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M11.5 3L5.5 9.5 2.5 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowRight({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M2.5 7.5h10M9 4l3.5 3.5L9 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0D0F0E]">

      {/* NAV */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-[#2A2D2C] bg-[#0D0F0E]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="font-display text-[17px] font-bold tracking-tight text-[#F2F0EB]">GymBot</span>
            <span className="rounded-md bg-[#A8FF3E] px-1.5 py-0.5 text-[11px] font-bold leading-none text-[#0D0F0E]">
              IA
            </span>
          </div>

          <div className="hidden items-center gap-8 text-sm text-[#8B8F8D] md:flex">
            <a href="#como-funciona" className="transition-colors duration-150 hover:text-[#F2F0EB]">
              Como funciona
            </a>
            <a href="#precios" className="transition-colors duration-150 hover:text-[#F2F0EB]">
              Precios
            </a>
            <Link href="/dashboard" className="text-[#F2F0EB] transition-colors duration-150 hover:text-[#A8FF3E]">
              Mi panel
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <MobileNav />
            <Link
              href="/setup"
              className="rounded-xl bg-[#A8FF3E] px-5 py-2.5 text-sm font-bold text-[#0D0F0E] transition-colors duration-150 hover:bg-[#8FE62A] active:scale-[0.97]"
            >
              Configurar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO - split layout with load-time reveal */}
      <section className="min-h-[100dvh] pt-16 flex items-center">
        <div className="mx-auto w-full max-w-6xl px-5 py-20">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-[1fr_420px] lg:gap-10">

            {/* Left: content — cascade reveal on load */}
            <div>
              <div
                style={{ animation: "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both" }}
                className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-[#A8FF3E]/25 bg-[#A8FF3E]/8 px-4 py-1.5 text-sm font-medium text-[#A8FF3E]"
              >
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#A8FF3E] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#A8FF3E]" />
                </span>
                30+ gimnasios en LATAM ya automatizados
              </div>

              <h1
                style={{ animation: "fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s both" }}
                className="font-display mb-6 text-5xl font-bold leading-[1.06] tracking-tight text-[#F2F0EB] md:text-6xl lg:text-[62px]"
              >
                Tu gimnasio responde{" "}
                <span className="text-[#A8FF3E]">solo en WhatsApp.</span>
              </h1>

              <p
                style={{ animation: "fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s both" }}
                className="mb-10 max-w-[500px] text-lg leading-relaxed text-[#8B8F8D]"
              >
                Para de perder leads. GymBot IA atiende a tus clientes 24/7, captura sus datos y te
                avisa cuando hay alguien listo para inscribirse.
              </p>

              <div
                style={{ animation: "fade-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.3s both" }}
                className="flex flex-wrap items-center gap-4"
              >
                <Link
                  href="/setup"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#A8FF3E] px-7 py-3.5 text-base font-bold text-[#0D0F0E] transition-colors duration-150 hover:bg-[#8FE62A] active:scale-[0.97]"
                >
                  Configurar mi GymBot
                  <ArrowRight />
                </Link>
                <a
                  href="#precios"
                  className="inline-flex items-center rounded-xl border border-[#2A2D2C] px-7 py-3.5 text-base font-semibold text-[#F2F0EB] transition-colors duration-150 hover:border-[#A8FF3E]/35"
                >
                  Ver precios
                </a>
              </div>

              <p
                style={{ animation: "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) 0.4s both" }}
                className="mt-5 text-sm text-[#8B8F8D]"
              >
                Sin tarjeta de credito · Activo en 24 horas · Cancela cuando quieras
              </p>
            </div>

            {/* Right: chat mockup (desktop only) */}
            <div
              style={{ animation: "fade-up 0.8s cubic-bezier(0.16,1,0.3,1) 0.25s both" }}
              className="hidden lg:block"
            >
              <div className="overflow-hidden rounded-2xl border border-[#2A2D2C] bg-[#141716] shadow-2xl shadow-black/50">
                <div className="flex items-center gap-3 border-b border-[#2A2D2C] bg-[#1A1D1C] px-4 py-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#A8FF3E] text-sm font-bold text-[#0D0F0E]">
                    GYM
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#F2F0EB]">Total Fit Gym</p>
                    <p className="flex items-center gap-1 text-xs text-[#A8FF3E]">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#A8FF3E]" />
                      En linea
                    </p>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[#2A2D2C] px-3.5 py-2.5 text-sm leading-relaxed text-[#F2F0EB]">
                      Hola! cuanto cuesta la membresia?
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-[#A8FF3E]/20 bg-[#A8FF3E]/10 px-3.5 py-2.5 text-sm leading-relaxed text-[#F2F0EB]">
                      Hola! 💪 Tenemos 3 opciones:
                      <br />Mensual: $89.000
                      <br />Trimestral: $240.000
                      <br />Anual: $800.000
                      <br /><br />Te interesa visitar el gym? Me dices tu nombre?
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[#2A2D2C] px-3.5 py-2.5 text-sm text-[#F2F0EB]">
                      Soy Sebastian, si me interesa
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-[#A8FF3E]/20 bg-[#A8FF3E]/10 px-3.5 py-2.5 text-sm leading-relaxed text-[#F2F0EB]">
                      Perfecto Sebastian! 🙌 A que numero te llamamos? El equipo te contacta hoy.
                    </div>
                  </div>
                </div>
                <div className="border-t border-[#2A2D2C] px-4 py-2.5 text-center text-xs text-[#8B8F8D]">
                  Respondido en 2 segundos por GymBot IA
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#2A2D2C] bg-[#141716] px-4 py-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#A8FF3E]/15 text-[#A8FF3E]">
                  <CheckIcon />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#F2F0EB]">Lead capturado</p>
                  <p className="text-xs text-[#8B8F8D]">Sebastian G. · hace 2 segundos</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* MOBILE CHAT - visible on small/medium, hidden on desktop */}
      <section className="px-5 pb-14 lg:hidden">
        <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-[#2A2D2C] bg-[#141716]">
          <div className="flex items-center gap-3 border-b border-[#2A2D2C] bg-[#1A1D1C] px-4 py-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#A8FF3E] text-xs font-bold text-[#0D0F0E]">
              GYM
            </div>
            <div>
              <p className="text-sm font-semibold text-[#F2F0EB]">Total Fit Gym</p>
              <p className="flex items-center gap-1 text-xs text-[#A8FF3E]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#A8FF3E]" />
                En linea
              </p>
            </div>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[#2A2D2C] px-3 py-2 text-sm text-[#F2F0EB]">
                Cuanto cuesta la membresia?
              </div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-[#A8FF3E]/20 bg-[#A8FF3E]/10 px-3 py-2 text-sm leading-relaxed text-[#F2F0EB]">
                Hola! 💪 Mensual: $89.000 · Trimestral: $240.000 · Anual: $800.000.
                <br /><br />Me dices tu nombre para coordinar una visita?
              </div>
            </div>
          </div>
          <div className="border-t border-[#2A2D2C] px-4 py-2.5 text-center text-xs text-[#8B8F8D]">
            Respondido en 2 segundos por GymBot IA
          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <FadeIn>
        <div className="border-y border-[#2A2D2C]">
          <div className="mx-auto max-w-6xl px-5">
            <div className="grid grid-cols-3 divide-x divide-[#2A2D2C]">
              {stats.map((stat) => (
                <div key={stat.label} className="py-8 text-center">
                  <p className="font-display text-3xl font-bold text-[#A8FF3E] md:text-4xl">{stat.value}</p>
                  <p className="mt-1 text-sm text-[#8B8F8D]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </FadeIn>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">

            <FadeIn className="lg:sticky lg:top-32 lg:self-start">
              <h2 className="font-display text-4xl font-bold leading-tight tracking-tight text-[#F2F0EB] md:text-5xl">
                Configurado en{" "}
                <span className="text-[#A8FF3E]">24 horas.</span>
              </h2>
              <p className="mt-4 max-w-sm text-lg leading-relaxed text-[#8B8F8D]">
                Sin tecnicos. Sin codigo. Solo llenas un formulario y tu bot empieza a trabajar.
              </p>
              <Link
                href="/setup"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#A8FF3E] px-6 py-3 text-sm font-bold text-[#0D0F0E] transition-colors duration-150 hover:bg-[#8FE62A]"
              >
                Empezar ahora
                <ArrowRight />
              </Link>
            </FadeIn>

            <div className="relative">
              <div className="absolute left-[23px] top-6 bottom-6 w-px bg-[#2A2D2C]" />
              <div className="space-y-10">
                {steps.map((step, i) => (
                  <FadeIn key={step.num} delay={i * 100}>
                    <div className="relative flex gap-6">
                      <div className="relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-[#2A2D2C] bg-[#141716]">
                        <span className="font-display text-xs font-bold text-[#A8FF3E]">{step.num}</span>
                      </div>
                      <div className="pt-2.5 pb-6">
                        <h3 className="font-display text-xl font-bold text-[#F2F0EB] mb-2">{step.title}</h3>
                        <p className="text-[#8B8F8D] leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-[#141716] px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <h2 className="font-display mb-14 text-3xl font-bold text-[#F2F0EB] md:text-4xl">
              Gimnasios que ya dejaron de perder leads
            </h2>
          </FadeIn>

          <div className="grid gap-5 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className="flex h-full flex-col justify-between rounded-2xl border border-[#2A2D2C] bg-[#0D0F0E] p-7">
                  <div>
                    <div className="font-display mb-4 select-none text-5xl font-bold leading-none text-[#A8FF3E]/25">
                      &ldquo;
                    </div>
                    <p className="text-[15px] leading-relaxed text-[#F2F0EB]">{t.text}</p>
                  </div>
                  <div className="mt-7 border-t border-[#2A2D2C] pt-5">
                    <p className="text-sm font-semibold text-[#F2F0EB]">{t.name}</p>
                    <p className="mt-0.5 text-xs text-[#8B8F8D]">{t.gym}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="precios" className="px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <FadeIn className="mb-14 max-w-xl">
            <h2 className="font-display text-4xl font-bold tracking-tight text-[#F2F0EB] md:text-5xl">
              Precios simples.
            </h2>
            <p className="mt-4 text-lg text-[#8B8F8D]">
              Los primeros 5 gimnasios pagan $49/mes en lugar de $79. Sin costo de setup.
            </p>
          </FadeIn>

          <div className="grid gap-5 md:grid-cols-3">
            {plans.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 80}>
                <div
                  className={`relative flex h-full flex-col rounded-2xl border p-7 ${
                    plan.highlight
                      ? "border-[#A8FF3E]/45 bg-gradient-to-b from-[#A8FF3E]/6 to-transparent"
                      : "border-[#2A2D2C] bg-[#141716]"
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#A8FF3E] px-4 py-0.5 text-[11px] font-bold text-[#0D0F0E]">
                      MAS POPULAR
                    </div>
                  )}
                  <div className="mb-7">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#8B8F8D]">
                      {plan.name}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-4xl font-bold text-[#F2F0EB]">{plan.price}</span>
                      <span className="text-sm text-[#8B8F8D]">{plan.period}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-[#8B8F8D]">{plan.note}</p>
                  </div>
                  <ul className="mb-7 flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-[#F2F0EB]">
                        <span className="mt-0.5 flex-shrink-0 text-[#A8FF3E]">
                          <CheckIcon />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/setup"
                    className={`block w-full rounded-xl py-3 text-center text-sm font-bold transition-colors duration-150 active:scale-[0.97] ${
                      plan.highlight
                        ? "bg-[#A8FF3E] text-[#0D0F0E] hover:bg-[#8FE62A]"
                        : "border border-[#2A2D2C] text-[#F2F0EB] hover:border-[#A8FF3E]/35 hover:text-[#A8FF3E]"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-5 py-24">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <div className="relative overflow-hidden rounded-3xl border border-[#A8FF3E]/18 bg-[#141716] p-12 text-center">
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-72 w-72 rounded-full bg-[#A8FF3E]/5 blur-3xl" />
              </div>
              <div className="relative">
                <h2 className="font-display text-3xl font-bold tracking-tight text-[#F2F0EB] md:text-4xl">
                  Cuantos leads perdiste hoy por no responder a tiempo?
                </h2>
                <p className="mx-auto mt-4 max-w-md leading-relaxed text-[#8B8F8D]">
                  Cada mensaje sin respuesta en menos de 5 minutos es un cliente que se va a la
                  competencia.
                </p>
                <Link
                  href="/setup"
                  className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#A8FF3E] px-9 py-4 text-base font-bold text-[#0D0F0E] transition-colors duration-150 hover:bg-[#8FE62A] active:scale-[0.97]"
                >
                  Activar mi GymBot ahora
                  <ArrowRight />
                </Link>
                <p className="mt-4 text-xs text-[#8B8F8D]">Sin tarjeta · Setup gratis · Activo en 24h</p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#2A2D2C] px-5 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-bold text-[#F2F0EB]">GymBot IA</span>
                <span className="text-[#2A2D2C]">|</span>
                <span className="text-sm text-[#8B8F8D]">by Nexora IA</span>
              </div>
              <p className="mt-1 text-xs text-[#8B8F8D]">&copy; 2026 Nexora IA · Medell&iacute;n, Colombia</p>
            </div>
            <nav aria-label="Footer" className="flex flex-wrap gap-6 text-sm text-[#8B8F8D]">
              <Link href="/setup" className="transition-colors duration-150 hover:text-[#F2F0EB]">
                Comenzar
              </Link>
              <a href="#como-funciona" className="transition-colors duration-150 hover:text-[#F2F0EB]">
                Como funciona
              </a>
              <a href="#precios" className="transition-colors duration-150 hover:text-[#F2F0EB]">
                Precios
              </a>
              <Link href="/dashboard" className="transition-colors duration-150 hover:text-[#F2F0EB]">
                Mi panel
              </Link>
            </nav>
          </div>
        </div>
      </footer>

    </div>
  )
}
