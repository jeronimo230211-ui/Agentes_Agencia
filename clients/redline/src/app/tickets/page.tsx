import { tickets, typeLabels, type Ticket } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, AlertCircle } from "lucide-react";

const columns: { key: Ticket["status"]; label: string; color: string; dot: string }[] = [
  { key: "nuevo", label: "Nuevo", color: "bg-blue-50 border-blue-200", dot: "bg-blue-500" },
  { key: "asignado", label: "Asignado", color: "bg-yellow-50 border-yellow-200", dot: "bg-yellow-500" },
  { key: "en_progreso", label: "En progreso", color: "bg-orange-50 border-orange-200", dot: "bg-orange-500" },
  { key: "resuelto", label: "Resuelto", color: "bg-green-50 border-green-200", dot: "bg-green-500" },
];

const priorityColor: Record<string, string> = {
  alta: "bg-red-100 text-red-700 border-red-200",
  media: "bg-yellow-100 text-yellow-700 border-yellow-200",
  baja: "bg-gray-100 text-gray-600 border-gray-200",
};

const typeIcon: Record<string, string> = {
  falla: "⚡",
  cambio_plan: "📋",
  instalacion: "🔧",
  cancelacion: "❌",
  otro: "💬",
};

function timeAgo(dateStr: string) {
  const now = new Date("2026-04-21T10:30:00");
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffM = Math.floor((diffMs % 3600000) / 60000);
  if (diffH > 0) return `hace ${diffH}h ${diffM}m`;
  return `hace ${diffM}m`;
}

export default function TicketsPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
        <p className="text-sm text-gray-500 mt-1">
          {tickets.filter((t) => t.status !== "resuelto").length} tickets activos ·{" "}
          {tickets.filter((t) => t.status === "nuevo").length} sin asignar
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {columns.map((col) => {
          const colTickets = tickets.filter((t) => t.status === col.key);
          return (
            <div key={col.key}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                <span className="ml-auto text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 font-medium">
                  {colTickets.length}
                </span>
              </div>

              <div className="space-y-3">
                {colTickets.map((ticket) => (
                  <Card key={ticket.id} className={`border shadow-sm hover:shadow-md transition-shadow cursor-pointer ${col.color}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs font-mono text-gray-400">{ticket.id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${priorityColor[ticket.priority]}`}>
                          {ticket.priority}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-base">{typeIcon[ticket.type]}</span>
                        <p className="text-xs font-medium text-gray-500">{typeLabels[ticket.type]}</p>
                      </div>

                      <p className="text-sm font-semibold text-gray-900 mb-1">{ticket.clientName}</p>
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{ticket.description}</p>

                      <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeAgo(ticket.createdAt)}
                        </span>
                        {ticket.technicianName ? (
                          <span className="text-xs text-gray-600 flex items-center gap-1 font-medium">
                            <User className="w-3 h-3" />
                            {ticket.technicianName.split(" ")[0]}
                          </span>
                        ) : (
                          <span className="text-xs text-red-500 flex items-center gap-1 font-medium">
                            <AlertCircle className="w-3 h-3" />
                            Sin asignar
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {colTickets.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">Sin tickets</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
