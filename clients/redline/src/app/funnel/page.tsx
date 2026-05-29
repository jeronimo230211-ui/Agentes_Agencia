"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clients, tickets, appointments } from "@/lib/mock-data";
import {
  TrendingUp, MessageCircle, UserCheck, ClipboardList,
  CalendarDays, CheckCircle2, ArrowDown, ChevronRight,
} from "lucide-react";

const stages = [
  {
    id: "contacto",
    label: "Primer contacto",
    desc: "Clientes que escribieron por WhatsApp",
    count: clients.length,
    icon: <MessageCircle className="w-5 h-5" />,
    color: "bg-blue-500",
    lightColor: "bg-blue-50 border-blue-100 text-blue-700",
    pct: 100,
  },
  {
    id: "datos",
    label: "Datos capturados",
    desc: "Bot recopiló nombre, cédula y correo",
    count: 7,
    icon: <UserCheck className="w-5 h-5" />,
    color: "bg-purple-500",
    lightColor: "bg-purple-50 border-purple-100 text-purple-700",
    pct: 87.5,
  },
  {
    id: "ticket",
    label: "Ticket creado",
    desc: "Se generó un ticket de soporte",
    count: tickets.length,
    icon: <ClipboardList className="w-5 h-5" />,
    color: "bg-orange-500",
    lightColor: "bg-orange-50 border-orange-100 text-orange-700",
    pct: 87.5,
  },
  {
    id: "cita",
    label: "Cita agendada",
    desc: "Visita técnica programada",
    count: appointments.length,
    icon: <CalendarDays className="w-5 h-5" />,
    color: "bg-yellow-500",
    lightColor: "bg-yellow-50 border-yellow-100 text-yellow-700",
    pct: 62.5,
  },
  {
    id: "resuelto",
    label: "Caso resuelto",
    desc: "Visita completada y cliente satisfecho",
    count: 3,
    icon: <CheckCircle2 className="w-5 h-5" />,
    color: "bg-green-500",
    lightColor: "bg-green-50 border-green-100 text-green-700",
    pct: 37.5,
  },
];

const insights = [
  {
    icon: "🤖",
    title: "Tasa de automatización",
    value: "87%",
    desc: "De los tickets se crean sin intervención humana",
    trend: "+12% vs mes anterior",
    up: true,
  },
  {
    icon: "⏱️",
    title: "Tiempo promedio de respuesta",
    value: "< 30 seg",
    desc: "Desde que el cliente escribe hasta tener ticket",
    trend: "-4 min vs proceso manual",
    up: true,
  },
  {
    icon: "📅",
    title: "Citas confirmadas",
    value: "75%",
    desc: "De las citas agendadas se confirman el mismo día",
    trend: "+23% vs proceso manual",
    up: true,
  },
  {
    icon: "😊",
    title: "Satisfacción post-visita",
    value: "4.6 / 5",
    desc: "Promedio de encuestas enviadas por Fijo",
    trend: "+0.8 vs año anterior",
    up: true,
  },
];

export default function FunnelPage() {
  const maxCount = stages[0].count;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Funnel de atención</h1>
        <p className="text-sm text-gray-500 mt-1">
          Visualiza cómo los clientes de RedLine avanzan desde el primer contacto hasta el caso resuelto.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Funnel visual */}
        <div className="col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-500" />
                Pipeline de clientes — Abril 2026
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stages.map((stage, i) => (
                  <div key={stage.id}>
                    <div className="flex items-center gap-4">
                      {/* Stage info */}
                      <div className="w-44 flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-800">{stage.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{stage.desc}</p>
                      </div>

                      {/* Bar */}
                      <div className="flex-1">
                        <div className="relative h-10 bg-gray-100 rounded-lg overflow-hidden">
                          <div
                            className={`absolute left-0 top-0 h-full ${stage.color} rounded-lg flex items-center justify-end pr-3 transition-all`}
                            style={{ width: `${stage.pct}%` }}
                          >
                            <span className="text-white text-sm font-bold">{stage.count}</span>
                          </div>
                        </div>
                      </div>

                      {/* Pct */}
                      <div className="w-14 text-right flex-shrink-0">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${stage.lightColor}`}>
                          {stage.pct}%
                        </span>
                      </div>
                    </div>

                    {/* Drop arrow */}
                    {i < stages.length - 1 && (
                      <div className="flex items-center gap-4 my-1">
                        <div className="w-44" />
                        <div className="flex-1 flex items-center gap-2 pl-2">
                          <ArrowDown className="w-3 h-3 text-gray-300" />
                          <span className="text-xs text-gray-400">
                            {stages[i + 1].count < stages[i].count
                              ? `${stages[i].count - stages[i + 1].count} no avanzan`
                              : ""}
                          </span>
                        </div>
                        <div className="w-14" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-6 p-4 bg-orange-50 border border-orange-100 rounded-xl">
                <p className="text-xs font-semibold text-orange-800 mb-1">
                  ✅ De 8 contactos, 3 casos resueltos esta semana
                </p>
                <p className="text-xs text-orange-700">
                  El 87% de los tickets se gestionaron completamente por Fijo sin que un agente tuviera que intervenir.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: stage detail list */}
        <div className="space-y-3">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className={`flex items-center gap-3 p-3 rounded-xl border ${stage.lightColor} cursor-pointer hover:shadow-sm transition-shadow`}
            >
              <div className={`w-8 h-8 rounded-lg ${stage.color} flex items-center justify-center text-white flex-shrink-0`}>
                {stage.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{stage.label}</p>
                <p className="text-lg font-bold">{stage.count}</p>
              </div>
              <ChevronRight className="w-4 h-4 opacity-40 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* KPI Insights */}
      <div className="mt-6">
        <h2 className="text-base font-bold text-gray-900 mb-4">Métricas clave de Fijo</h2>
        <div className="grid grid-cols-4 gap-4">
          {insights.map((ins) => (
            <Card key={ins.title} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="text-2xl mb-2">{ins.icon}</div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{ins.title}</p>
                <p className="text-2xl font-bold text-gray-900 mb-1">{ins.value}</p>
                <p className="text-xs text-gray-500 mb-2">{ins.desc}</p>
                <div className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  ins.up ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                }`}>
                  <TrendingUp className="w-3 h-3" />
                  {ins.trend}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* What's a funnel explanation */}
      <div className="mt-6 p-5 bg-gray-50 border border-gray-200 rounded-xl">
        <h3 className="text-sm font-bold text-gray-900 mb-2">¿Para qué sirve el funnel en Fijo?</h3>
        <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
          <div>
            <p className="font-semibold text-gray-700 mb-1">📊 Detectar cuellos de botella</p>
            <p>Identificar en qué etapa se pierden más clientes y por qué no avanzan al siguiente paso.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1">🤖 Medir impacto del bot</p>
            <p>Ver cuántos casos resuelve Fijo de forma autónoma vs. cuántos necesitan intervención humana.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1">📈 Optimizar el proceso</p>
            <p>Tomar decisiones basadas en datos reales: ajustar flujos del bot, horarios, o capacidad técnica.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
