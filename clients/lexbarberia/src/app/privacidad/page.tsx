import Link from "next/link"
import type { Metadata } from "next"

// Página pública exigida por Google para publicar la app de OAuth (acceso a
// Google Calendar). Debe describir con honestidad qué datos se usan y para qué.

export const metadata: Metadata = {
  title: "Política de privacidad — Lex Barbería",
}

const UPDATED = "4 de octubre de 2026"

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 space-y-6 text-sm leading-relaxed">
      <div className="space-y-1">
        <h1 className="font-display text-3xl">Política de privacidad</h1>
        <p className="text-muted-foreground">Lex Barbería · Última actualización: {UPDATED}</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Qué es este servicio</h2>
        <p>
          Lex Barbería (Medellín, Colombia) usa este sistema para que sus clientes agenden, cambien y cancelen turnos por
          WhatsApp con un asistente automático, y para que el barbero administre su agenda.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Qué datos usamos</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>De los clientes: nombre, número de WhatsApp, los mensajes que le escriben al asistente y sus citas (fecha, hora y servicio).</li>
          <li>Del barbero: acceso a su Google Calendar, únicamente para crear y borrar los eventos de las citas.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Para qué los usamos</h2>
        <p>
          Solo para gestionar las citas: responder por WhatsApp, enviar recordatorios de la cita y mantener la agenda del
          barbero actualizada. No vendemos, alquilamos ni compartimos estos datos con terceros para publicidad.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Google Calendar</h2>
        <p>
          El acceso a Google Calendar se usa exclusivamente para crear un evento cuando se agenda una cita y borrarlo cuando
          se cancela. No leemos ni usamos otros eventos del calendario. El uso de la información recibida de las APIs de
          Google cumple la{" "}
          <a className="underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
            Política de datos de usuario de los servicios de API de Google
          </a>
          , incluidos los requisitos de uso limitado. El barbero puede desconectar su calendario en cualquier momento desde
          el panel o desde su cuenta de Google.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Servicios que procesan los datos</h2>
        <p>
          Para funcionar, el sistema usa: WhatsApp (Meta) para los mensajes, Anthropic (Claude) para que el asistente entienda
          y responda, Supabase para guardar las citas y Vercel para alojar el sistema.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Tus derechos</h2>
        <p>
          Puedes pedir en cualquier momento que borremos tus datos o tu historial de conversación escribiendo por WhatsApp a
          Lex Barbería. Atendemos la solicitud conforme a la Ley 1581 de 2012 de protección de datos personales de Colombia.
        </p>
      </section>

      <p className="pt-4">
        <Link href="/" className="underline text-muted-foreground">
          Volver al inicio
        </Link>
      </p>
    </main>
  )
}
