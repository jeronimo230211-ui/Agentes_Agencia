import { tickets, appointments, technicians, typeLabels } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  CalendarCheck,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  User,
  Zap,
} from "lucide-react";

const statusColor: Record<string, string> = {
  nuevo: "bg-blue-100 text-blue-700",
  asignado: "bg-yellow-100 text-yellow-700",
  en_progreso: "bg-orange-100 text-orange-700",
  resuelto: "bg-green-100 text-green-700",
};

const priorityColor: Record<string, string> = {
  alta: "bg-red-100 text-red-700",
  media: "bg-yellow-100 text-yellow-700",
  baja: "bg-gray-100 text-gray-600",
};

const appointmentStatusColor: Record<string, string> = {
  confirmado: "bg-green-100 text-green-700",
  pendiente: "bg-yellow-100 text-yellow-700",
  sin_confirmar: "bg-red-100 text-red-700",
  cancelado: "bg-gray-100 text-gray-500",
};

const openTickets = tickets.filter((t) => t.status !== "resuelto");
const todayAppointments = appointments.filter((a) => a.date === "2026-04-21");
const resolvedToday = tickets.filter((t) => t.status === "resuelto").length;
const unassigned = tickets.filter((t) => t.status === "nuevo").length;

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Buenos días, RedLine</h1>
        </div>
        <p className="text-gray-500 text-sm ml-11">Lunes, 21 de abril de 2026 · Todo bajo control</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">Tickets abiertos</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{openTickets.length}</p>
                <p className="text-xs text-orange-600 mt-1 font-medium">{unassigned} sin asignar</p>
              </div>
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">Citas hoy</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{todayAppointments.length}</p>
                <p className="text-xs text-green-600 mt-1 font-medium">
                  {todayAppointments.filter((a) => a.status === "confirmado").length} confirmadas
                </p>
              </div>
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                <CalendarCheck className="w-5 h-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">Resueltos hoy</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{resolvedToday}</p>
                <p className="text-xs text-green-600 mt-1 font-medium">+2 vs. ayer</p>
              </div>
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">Tiempo resp. prom.</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">2.4h</p>
                <p className="text-xs text-green-600 mt-1 font-medium">↓ 84% vs. antes</p>
              </div>
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Recent tickets */}
        <div className="col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-gray-900">Tickets recientes</CardTitle>
                <a href="/tickets" className="text-sm text-orange-500 hover:text-orange-600 font-medium">Ver todos →</a>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tickets.slice(0, 5).map((ticket) => (
                  <div key={ticket.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-400">{ticket.id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor[ticket.priority]}`}>
                          {ticket.priority}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">{ticket.clientName}</p>
                      <p className="text-xs text-gray-500 truncate">{ticket.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[ticket.status]}`}>
                        {ticket.status === "nuevo" ? "Nuevo" : ticket.status === "asignado" ? "Asignado" : ticket.status === "en_progreso" ? "En progreso" : "Resuelto"}
                      </span>
                      {ticket.technicianName && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <User className="w-3 h-3" /> {ticket.technicianName.split(" ")[0]}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Today's appointments */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-900">Citas de hoy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todayAppointments.map((apt) => (
                  <div key={apt.id} className="flex items-start gap-3">
                    <div className="text-center min-w-[40px]">
                      <p className="text-base font-bold text-gray-900 leading-none">{apt.time}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{apt.clientName}</p>
                      <p className="text-xs text-gray-500">{typeLabels[apt.type]}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${appointmentStatusColor[apt.status]}`}>
                        {apt.status === "confirmado" ? "Confirmado" : apt.status === "pendiente" ? "Pendiente confirmación" : "Sin confirmar"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Technician status */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-900">Técnicos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {technicians.map((tech) => (
                  <div key={tech.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {tech.avatar}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{tech.name}</p>
                      <p className="text-xs text-gray-500">{tech.ticketsHoy} citas hoy</p>
                    </div>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${tech.status === "disponible" ? "bg-green-500" : tech.status === "en_cita" ? "bg-orange-500" : "bg-gray-300"}`} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Fijo alert */}
          <Card className="border-0 shadow-sm bg-orange-50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-orange-900">Fijo funcionando</p>
                  <p className="text-xs text-orange-700 mt-0.5">
                    3 recordatorios de cita enviados hoy. 0 citas sin confirmar para mañana.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
