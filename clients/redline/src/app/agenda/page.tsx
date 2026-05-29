"use client";

import { useState } from "react";
import { appointments, typeLabels, Appointment } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import {
  MapPin, User, CheckCircle2, Clock, XCircle, AlertTriangle,
  Bell, List, CalendarDays, Calendar, ChevronLeft, ChevronRight,
  Plus,
} from "lucide-react";

type View = "lista" | "semana" | "mes";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode; bg: string; dot: string }> = {
  confirmado: {
    label: "Confirmado", color: "text-green-700", bg: "bg-green-50 border-green-200", dot: "bg-green-500",
    icon: <CheckCircle2 className="w-4 h-4 text-green-600" />,
  },
  pendiente: {
    label: "Pendiente", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", dot: "bg-yellow-400",
    icon: <Clock className="w-4 h-4 text-yellow-600" />,
  },
  sin_confirmar: {
    label: "Sin confirmar", color: "text-red-700", bg: "bg-red-50 border-red-200", dot: "bg-red-500",
    icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
  },
  cancelado: {
    label: "Cancelado", color: "text-gray-500", bg: "bg-gray-50 border-gray-200", dot: "bg-gray-400",
    icon: <XCircle className="w-4 h-4 text-gray-400" />,
  },
};

const typeIcon: Record<string, string> = {
  falla: "⚡", cambio_plan: "📋", instalacion: "🔧", cancelacion: "❌", otro: "💬",
};

const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const weekDates = ["21", "22", "23", "24", "25", "26", "27"];
const weekFullDates = [
  "2026-04-21", "2026-04-22", "2026-04-23",
  "2026-04-24", "2026-04-25", "2026-04-26", "2026-04-27",
];

const BUSINESS_START = 7;
const BUSINESS_END = 18;
const hours = Array.from({ length: BUSINESS_END - BUSINESS_START + 1 }, (_, i) => BUSINESS_START + i);

const MONTH_DAYS = 30;
const MONTH_START_DOW = 2; // April 1 = Wednesday (0=Sun, 1=Mon, 2=Tue, 3=Wed...)

function timeToRow(time: string): number {
  const [h] = time.split(":").map(Number);
  return h - BUSINESS_START;
}

function getApptsForDayHour(dateStr: string, hour: number): Appointment[] {
  return appointments.filter((a) => {
    const [h] = a.time.split(":").map(Number);
    return a.date === dateStr && h === hour;
  });
}

function getApptsForDay(dateStr: string): Appointment[] {
  return appointments.filter((a) => a.date === dateStr);
}

const aptColors: Record<string, string> = {
  falla: "bg-red-100 border-red-300 text-red-800",
  instalacion: "bg-blue-100 border-blue-300 text-blue-800",
  cambio_plan: "bg-purple-100 border-purple-300 text-purple-800",
  cancelacion: "bg-gray-100 border-gray-300 text-gray-600",
  otro: "bg-slate-100 border-slate-300 text-slate-700",
};

export default function AgendaPage() {
  const [view, setView] = useState<View>("lista");

  const todayApts = appointments.filter((a) => a.date === "2026-04-21");
  const weekApts = appointments.filter((a) => weekFullDates.includes(a.date));
  const pendingCount = appointments.filter((a) => a.status === "pendiente" || a.status === "sin_confirmar").length;
  const confirmedToday = todayApts.filter((a) => a.status === "confirmado").length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda de citas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {confirmedToday} confirmadas hoy · {pendingCount} pendientes de confirmar
          </p>
        </div>
        <button className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <Plus className="w-4 h-4" />
          Nueva cita
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Hoy", value: todayApts.length, icon: <CalendarDays className="w-5 h-5 text-orange-400" />, color: "text-orange-600" },
          { label: "Esta semana", value: weekApts.length, icon: <Calendar className="w-5 h-5 text-blue-400" />, color: "text-blue-600" },
          { label: "Pendientes", value: pendingCount, icon: <Clock className="w-5 h-5 text-yellow-400" />, color: "text-yellow-600" },
          { label: "Completadas", value: 3, icon: <CheckCircle2 className="w-5 h-5 text-green-400" />, color: "text-green-600" },
        ].map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              {stat.icon}
              <div>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Business hours notice */}
      <div className="mb-5 flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
        <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <p className="text-xs text-blue-700 font-medium">
          Horario laboral: Lunes a Sábado · 7:00 AM – 6:00 PM · El bot no agenda citas fuera de estos horarios.
        </p>
      </div>

      {/* View toggle */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          {([
            { id: "lista", label: "Lista", icon: List },
            { id: "semana", label: "Semana", icon: CalendarDays },
            { id: "mes", label: "Mes", icon: Calendar },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                view === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
          <button className="p-1 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>Semana 21–27 de abril, 2026</span>
          <button className="p-1 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Alert for pending */}
      {pendingCount > 0 && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <Bell className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {pendingCount} cita{pendingCount > 1 ? "s" : ""} necesitan confirmación
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Fijo enviará recordatorio automático por WhatsApp 2 horas antes.
            </p>
          </div>
        </div>
      )}

      {/* LISTA VIEW */}
      {view === "lista" && <ListView />}

      {/* SEMANA VIEW */}
      {view === "semana" && <WeekView />}

      {/* MES VIEW */}
      {view === "mes" && <MonthView />}
    </div>
  );
}

function ListView() {
  const dateLabels: Record<string, string> = {
    "2026-04-21": "Hoy — Lunes 21 de abril",
    "2026-04-22": "Mañana — Martes 22 de abril",
    "2026-04-23": "Miércoles 23 de abril",
    "2026-04-24": "Jueves 24 de abril",
  };

  const groupedByDate = appointments.reduce((acc, apt) => {
    if (!acc[apt.date]) acc[apt.date] = [];
    acc[apt.date].push(apt);
    return acc;
  }, {} as Record<string, Appointment[]>);

  return (
    <div className="space-y-8">
      {Object.entries(groupedByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, apts]) => (
          <div key={date}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {dateLabels[date] || date}
            </h2>
            <div className="space-y-3">
              {apts
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((apt) => {
                  const cfg = statusConfig[apt.status];
                  return (
                    <Card key={apt.id} className={`border shadow-sm ${cfg.bg}`}>
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="text-center min-w-[56px]">
                            <p className="text-xl font-bold text-gray-900 leading-none">{apt.time}</p>
                            <p className="text-xs text-gray-400 mt-1">{apt.duration}min</p>
                          </div>
                          <div className="w-px bg-gray-200 self-stretch" />
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-base">{typeIcon[apt.type]}</span>
                                  <p className="text-xs text-gray-500 font-medium">{typeLabels[apt.type]}</p>
                                  <span className="text-xs font-mono text-gray-400">{apt.ticketId}</span>
                                </div>
                                <p className="text-base font-semibold text-gray-900">{apt.clientName}</p>
                                <p className="text-sm text-gray-500">{apt.clientPhone}</p>
                              </div>
                              <div className={`flex items-center gap-1.5 text-sm font-medium ${cfg.color}`}>
                                {cfg.icon}
                                {cfg.label}
                              </div>
                            </div>
                            <div className="mt-3 flex items-center gap-5 text-sm text-gray-500">
                              <span className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5" />
                                {apt.address}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5" />
                                {apt.technicianName}
                              </span>
                            </div>
                            {apt.status === "sin_confirmar" && (
                              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-xs text-red-700 font-medium">
                                  ⚠️ Fijo enviará recordatorio en 4 horas. Si no confirma → reagendamiento automático.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>
        ))}
    </div>
  );
}

function WeekView() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
        <div className="p-2 border-r border-gray-100" />
        {weekDays.map((day, i) => {
          const isToday = i === 0;
          const isSunday = i === 6;
          return (
            <div
              key={day}
              className={`p-3 text-center border-r border-gray-100 last:border-0 ${isSunday ? "bg-gray-50" : ""}`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wide ${isSunday ? "text-gray-400" : "text-gray-500"}`}>
                {day}
              </p>
              <p className={`text-lg font-bold mt-0.5 w-8 h-8 flex items-center justify-center rounded-full mx-auto ${
                isToday ? "bg-orange-500 text-white" : isSunday ? "text-gray-400" : "text-gray-900"
              }`}>
                {weekDates[i]}
              </p>
              {isSunday && <p className="text-xs text-gray-400 mt-0.5">Cerrado</p>}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
        {hours.map((hour) => {
          const isOutsideBusiness = hour < BUSINESS_START || hour >= BUSINESS_END;
          return (
            <div
              key={hour}
              className="grid border-b border-gray-100 last:border-0"
              style={{ gridTemplateColumns: "60px repeat(7, 1fr)", minHeight: 56 }}
            >
              <div className="p-2 border-r border-gray-100 flex items-start justify-end pr-3 pt-2">
                <span className="text-xs text-gray-400 font-medium">{hour}:00</span>
              </div>
              {weekFullDates.map((dateStr, di) => {
                const isSunday = di === 6;
                const colApts = getApptsForDayHour(dateStr, hour);
                const isNonBusiness = isSunday || isOutsideBusiness;

                return (
                  <div
                    key={dateStr}
                    className={`border-r border-gray-100 last:border-0 p-1 relative ${
                      isNonBusiness ? "bg-gray-50" : "hover:bg-orange-50/30"
                    }`}
                  >
                    {colApts.map((apt) => (
                      <div
                        key={apt.id}
                        className={`rounded-md px-2 py-1 border text-xs font-medium truncate ${aptColors[apt.type]}`}
                        title={`${apt.clientName} — ${typeLabels[apt.type]}`}
                      >
                        <span className="font-bold">{apt.time}</span> {apt.clientName.split(" ")[0]}
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[apt.status].dot}`} />
                          <span className="text-xs opacity-70">{apt.technicianName.split(" ")[0]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthView() {
  const weeks: (number | null)[][] = [];
  let day = 1 - MONTH_START_DOW;

  while (day <= MONTH_DAYS) {
    const week: (number | null)[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(day >= 1 && day <= MONTH_DAYS ? day : null);
      day++;
    }
    weeks.push(week);
  }

  function getDateStr(day: number): string {
    return `2026-04-${String(day).padStart(2, "0")}`;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
        {weekDays.map((d, i) => (
          <div
            key={d}
            className={`p-3 text-center text-xs font-semibold uppercase tracking-wide border-r border-gray-100 last:border-0 ${
              i === 6 ? "text-gray-400 bg-gray-50" : "text-gray-500"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {weeks.map((week, wi) => (
        <div
          key={wi}
          className="grid border-b border-gray-100 last:border-0"
          style={{ gridTemplateColumns: "repeat(7, 1fr)", minHeight: 80 }}
        >
          {week.map((day, di) => {
            const isSunday = di === 6;
            const isToday = day === 21;
            const dateStr = day ? getDateStr(day) : "";
            const dayApts = day ? getApptsForDay(dateStr) : [];

            return (
              <div
                key={di}
                className={`border-r border-gray-100 last:border-0 p-2 ${
                  !day ? "bg-gray-50/50" : isSunday ? "bg-gray-50" : "hover:bg-orange-50/20"
                }`}
              >
                {day && (
                  <>
                    <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mb-1 ${
                      isToday ? "bg-orange-500 text-white" : isSunday ? "text-gray-400" : "text-gray-700"
                    }`}>
                      {day}
                    </span>
                    <div className="space-y-0.5">
                      {dayApts.slice(0, 2).map((apt) => (
                        <div
                          key={apt.id}
                          className={`text-xs px-1.5 py-0.5 rounded truncate border ${aptColors[apt.type]}`}
                          title={`${apt.time} — ${apt.clientName}`}
                        >
                          {apt.time} {apt.clientName.split(" ")[0]}
                        </div>
                      ))}
                      {dayApts.length > 2 && (
                        <p className="text-xs text-gray-400 pl-1">+{dayApts.length - 2} más</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
