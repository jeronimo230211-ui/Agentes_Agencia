"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle2, Clock, Zap, ArrowRight, UserCircle2,
  Phone, Mail, CreditCard, Bot, User, AlertCircle,
} from "lucide-react";

type MessageFrom = "cliente" | "bot" | "system";

type Message = {
  from: MessageFrom;
  text: string;
  time: string;
  isTicket?: boolean;
  dataKey?: "nombre" | "cedula" | "correo";
};

const conversation: Message[] = [
  {
    from: "cliente",
    text: "Buenas, llevo desde ayer sin internet y necesito que me manden un técnico 😤",
    time: "08:14",
  },
  {
    from: "bot",
    text: "¡Hola! Soy el asistente de RedLine 👋 Lamento el inconveniente, voy a ayudarte ahora mismo.\n\n¿Me confirmas tu nombre completo?",
    time: "08:14",
  },
  {
    from: "cliente",
    text: "María López",
    time: "08:15",
  },
  {
    from: "system",
    text: "Datos guardados: nombre: María López",
    time: "08:15",
    dataKey: "nombre",
  },
  {
    from: "bot",
    text: "Gracias, María. Para verificar tu cuenta, ¿me das tu número de cédula?",
    time: "08:15",
  },
  {
    from: "cliente",
    text: "1.023.456.789",
    time: "08:16",
  },
  {
    from: "system",
    text: "Datos guardados: cédula: 1.023.456.789",
    time: "08:16",
    dataKey: "cedula",
  },
  {
    from: "bot",
    text: "Perfecto. ¿Y tu correo electrónico para enviarte la confirmación de la visita?",
    time: "08:16",
  },
  {
    from: "cliente",
    text: "maria.lopez@gmail.com",
    time: "08:16",
  },
  {
    from: "system",
    text: "Datos guardados: correo: maria.lopez@gmail.com",
    time: "08:16",
    dataKey: "correo",
  },
  {
    from: "bot",
    text: "✅ Listo, María. Ya tengo tus datos registrados.\n\n📋 Plan: Fibra 100 Mbps\n📍 Calle 45 #12-34, Barrio El Centro\n\nCuéntame, ¿qué está pasando con el servicio?",
    time: "08:17",
  },
  {
    from: "cliente",
    text: "No enciende ninguna luz en el router, lo apagué y prendí y nada",
    time: "08:17",
  },
  {
    from: "bot",
    text: "Entendido. Parece una falla en el equipo. Voy a crear el ticket ahora 🔧",
    time: "08:18",
    isTicket: true,
  },
  {
    from: "bot",
    text: "✅ *Ticket TK-008 creado* — Falla técnica (Alta prioridad)\n\nTe tengo estos horarios disponibles (lunes a sábado, 7AM–6PM):\n\n1️⃣ *Hoy mar 21/04* — 2:00 PM\n2️⃣ *Mañana mié 22/04* — 8:00 AM\n3️⃣ *Mañana mié 22/04* — 3:00 PM\n\n¿Cuál te queda mejor?",
    time: "08:18",
  },
  {
    from: "cliente",
    text: "La 2, mañana a las 8am me queda bien",
    time: "08:19",
  },
  {
    from: "bot",
    text: "Perfecto 🎉 Quedó agendado:\n\n📅 *Miércoles 22 de abril — 8:00 AM*\n👨‍🔧 Técnico: Diego Ramírez\n📍 Calle 45 #12-34, Barrio El Centro\n\n🔔 Recibirás confirmación en tu correo y un recordatorio esta noche a las 8PM. ¿Algo más en que pueda ayudarte?",
    time: "08:19",
  },
  {
    from: "cliente",
    text: "No, muchas gracias! Por fin alguien que responde rápido 😊",
    time: "08:20",
  },
];

const ticketCreated = {
  id: "TK-008",
  client: "María López",
  cedula: "1.023.456.789",
  correo: "maria.lopez@gmail.com",
  type: "Falla técnica",
  priority: "Alta",
  tech: "Diego Ramírez",
  date: "Mié 22/04 — 8:00 AM",
  status: "Asignado",
  createdAt: "08:18",
};

const flowSteps = [
  { icon: "💬", label: "Cliente escribe" },
  { icon: "🤖", label: "Bot recopila datos" },
  { icon: "📋", label: "Ticket automático" },
  { icon: "📅", label: "Cita agendada" },
  { icon: "🔔", label: "Recordatorios" },
];

export default function WhatsAppPage() {
  const [visibleCount, setVisibleCount] = useState(2);
  const [botActive, setBotActive] = useState(true);
  const [intervened, setIntervened] = useState(false);

  const isFinished = visibleCount >= conversation.length;

  const nombreCaptured = visibleCount >= 4;
  const cedulaCaptured = visibleCount >= 7;
  const correoCaptured = visibleCount >= 10;
  const ticketVisible = visibleCount >= 13;
  const appointmentVisible = visibleCount >= 16;

  function handleIntervenir() {
    setIntervened(true);
    setBotActive(false);
  }

  function handleReactivar() {
    setIntervened(false);
    setBotActive(true);
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bot de WhatsApp con IA</h1>
        <p className="text-sm text-gray-500 mt-1">
          Así maneja Fijo una solicitud — recopila datos, crea el ticket y agenda la visita sin intervención humana.
        </p>
      </div>

      {/* Flow steps */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {flowSteps.map((step, i) => (
          <div key={i} className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
              <span className="text-lg">{step.icon}</span>
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">{step.label}</span>
            </div>
            {i < flowSteps.length - 1 && (
              <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* WhatsApp chat */}
        <div className="col-span-3">
          <Card className="border-0 shadow-sm overflow-hidden">
            {/* WA Header */}
            <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-300 flex items-center justify-center text-green-900 font-bold text-sm flex-shrink-0">
                RL
              </div>
              <div>
                <p className="text-white text-sm font-semibold">RedLine Soporte</p>
                <p className="text-green-200 text-xs">en línea</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                {botActive ? (
                  <Bot className="w-3.5 h-3.5 text-green-300" />
                ) : (
                  <User className="w-3.5 h-3.5 text-orange-300" />
                )}
                <span className={`text-xs font-medium ${botActive ? "text-green-200" : "text-orange-200"}`}>
                  {botActive ? "Fijo IA" : "Agente humano"}
                </span>
              </div>
            </div>

            {/* Intervention banner */}
            {intervened && (
              <div className="bg-orange-50 border-b border-orange-200 px-4 py-2.5 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                <p className="text-xs text-orange-700 font-medium flex-1">
                  Agente humano tomó el control de la conversación
                </p>
                <button
                  onClick={handleReactivar}
                  className="text-xs text-orange-600 hover:text-orange-800 font-semibold underline"
                >
                  Reactivar bot
                </button>
              </div>
            )}

            {/* Messages */}
            <div
              className="bg-[#E5DDD5] p-4 space-y-2 overflow-y-auto"
              style={{
                minHeight: 440,
                backgroundImage: "radial-gradient(circle, #d4c8bc 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            >
              {conversation.slice(0, visibleCount).map((msg, i) => {
                if (msg.from === "system") {
                  return (
                    <div key={i} className="flex justify-center">
                      <div className="bg-[#FFF9C4] border border-yellow-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
                        <CheckCircle2 className="w-3 h-3 text-yellow-600" />
                        <span className="text-xs text-yellow-800 font-medium">{msg.text}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={i} className={`flex ${msg.from === "cliente" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[78%] rounded-xl px-4 py-2.5 shadow-sm ${
                        msg.from === "cliente"
                          ? "bg-[#DCF8C6] rounded-tr-sm"
                          : msg.isTicket
                          ? "bg-orange-100 border border-orange-200 rounded-tl-sm"
                          : "bg-white rounded-tl-sm"
                      }`}
                    >
                      {msg.isTicket && (
                        <div className="flex items-center gap-1 mb-1">
                          <Zap className="w-3 h-3 text-orange-500" />
                          <span className="text-xs font-semibold text-orange-600">Fijo creó el ticket</span>
                        </div>
                      )}
                      <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{msg.text}</p>
                      <p className="text-xs text-gray-400 text-right mt-1">{msg.time}</p>
                    </div>
                  </div>
                );
              })}

              {!isFinished && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="p-4 bg-white border-t border-gray-100 flex items-center gap-3">
              <button
                onClick={() => setVisibleCount((c) => Math.min(c + 2, conversation.length))}
                disabled={isFinished}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                {isFinished ? "✅ Conversación completada" : "▶ Siguiente →"}
              </button>
              {visibleCount > 2 && (
                <button
                  onClick={() => setVisibleCount(2)}
                  className="text-sm text-gray-400 hover:text-gray-600 font-medium"
                >
                  Reiniciar
                </button>
              )}
            </div>
          </Card>
        </div>

        {/* Right panel */}
        <div className="col-span-2 space-y-4">
          {/* Header actions */}
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              botActive
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-orange-50 border-orange-200 text-orange-700"
            }`}>
              <span className={`w-2 h-2 rounded-full ${botActive ? "bg-green-500" : "bg-orange-400"}`} />
              {botActive ? "Bot IA ON" : "Bot IA OFF"}
            </div>
            <button
              onClick={botActive ? handleIntervenir : handleReactivar}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                botActive
                  ? "bg-white border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-600"
                  : "bg-green-500 border-green-500 text-white hover:bg-green-600"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              {botActive ? "Intervenir" : "Reactivar bot"}
            </button>
          </div>

          {/* Datos del Cliente */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <UserCircle2 className="w-4 h-4 text-gray-500" />
                Datos del Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                <DataRow
                  icon={<User className="w-3.5 h-3.5 text-gray-400" />}
                  label="Nombre"
                  value={nombreCaptured ? "María López" : undefined}
                />
                <DataRow
                  icon={<CreditCard className="w-3.5 h-3.5 text-gray-400" />}
                  label="Cédula"
                  value={cedulaCaptured ? "1.023.456.789" : undefined}
                />
                <DataRow
                  icon={<Mail className="w-3.5 h-3.5 text-gray-400" />}
                  label="Correo"
                  value={correoCaptured ? "maria.lopez@gmail.com" : undefined}
                />
                <DataRow
                  icon={<Phone className="w-3.5 h-3.5 text-gray-400" />}
                  label="WhatsApp"
                  value="+57 310 123 4567"
                />
              </div>

              {correoCaptured && (
                <div className="mt-3 pt-3 border-t border-gray-50 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-400">Plan</span>
                    <span className="text-xs font-semibold text-gray-700">Fibra 100 Mbps</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-400">Cliente desde</span>
                    <span className="text-xs font-semibold text-gray-700">Mar 2022</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-400">Registrado</span>
                    <span className="text-xs font-semibold text-gray-700">21/04/2026 — 08:16</span>
                  </div>
                </div>
              )}

              {!nombreCaptured && (
                <p className="text-xs text-gray-400 text-center py-2 mt-1">
                  Esperando datos del cliente...
                </p>
              )}
            </CardContent>
          </Card>

          {/* Ticket auto-created */}
          <Card className={`border-0 shadow-sm transition-all duration-500 ${ticketVisible ? "opacity-100" : "opacity-25"}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-500" />
                Ticket generado automáticamente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {([
                  ["ID", ticketCreated.id],
                  ["Tipo", ticketCreated.type],
                  ["Prioridad", ticketCreated.priority],
                  ["Técnico", ticketCreated.tech],
                  ["Cita", ticketCreated.date],
                  ["Estado", ticketCreated.status],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between py-0.5 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-400">{label}</span>
                    <span className="text-xs font-semibold text-gray-800">{value}</span>
                  </div>
                ))}
              </div>
              {ticketVisible && (
                <div className="mt-3 p-2.5 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-700 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Creado a las {ticketCreated.createdAt} — sin intervención humana
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reminders */}
          <Card className={`border-0 shadow-sm transition-all duration-500 ${appointmentVisible ? "opacity-100" : "opacity-25"}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900">Recordatorios programados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {[
                  { time: "Hoy 8:00 PM", msg: "Recordatorio de cita mañana", status: "programado" },
                  { time: "Mañana 6:00 AM", msg: "Tu cita es en 2 horas — confirmar", status: "automático" },
                  { time: "Mañana 7:45 AM", msg: "¿Confirmó el técnico? Si no → alerta", status: "automático" },
                  { time: "Mañana 10:00 AM", msg: "¿Se resolvió el problema? Encuesta", status: "post-visita" },
                ].map((r, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <Clock className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{r.time}</p>
                      <p className="text-xs text-gray-500">{r.msg}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DataRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      {value ? (
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-gray-800">{value}</span>
          <CheckCircle2 className="w-3 h-3 text-green-500" />
        </div>
      ) : (
        <span className="text-xs text-gray-300">—</span>
      )}
    </div>
  );
}
