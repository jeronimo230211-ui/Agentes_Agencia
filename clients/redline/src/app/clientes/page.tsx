"use client";

import { useState } from "react";
import { clients, leadStateLabels, LeadState, BotStatus } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Bot, User, Search, Download, UserCheck, UserX } from "lucide-react";

const leadColors: Record<LeadState, string> = {
  nuevo: "bg-gray-100 text-gray-600",
  interesado: "bg-yellow-100 text-yellow-700",
  en_proceso: "bg-blue-100 text-blue-700",
  activo: "bg-green-100 text-green-700",
  inactivo: "bg-red-100 text-red-600",
};

const filterTabs: { id: LeadState | "todos"; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "nuevo", label: "Nuevos" },
  { id: "interesado", label: "Interesados" },
  { id: "en_proceso", label: "En proceso" },
  { id: "activo", label: "Activos" },
  { id: "inactivo", label: "Inactivos" },
];

export default function ClientesPage() {
  const [filter, setFilter] = useState<LeadState | "todos">("todos");
  const [search, setSearch] = useState("");

  const filtered = clients.filter((c) => {
    const matchesFilter = filter === "todos" || c.leadState === filter;
    const matchesSearch =
      search === "" ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.cedula.includes(search);
    return matchesFilter && matchesSearch;
  });

  const total = clients.length;
  const activos = clients.filter((c) => c.leadState === "activo").length;
  const enProceso = clients.filter((c) => c.leadState === "en_proceso").length;
  const botActivos = clients.filter((c) => c.botStatus === "activo").length;
  const botHumano = clients.filter((c) => c.botStatus === "humano").length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona y visualiza todos tus contactos en un solo lugar
          </p>
        </div>
        <button className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
          <Download className="w-4 h-4" />
          Exportar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total", value: total, icon: <Users className="w-5 h-5 text-gray-400" />, color: "text-gray-700" },
          { label: "Activos", value: activos, icon: <UserCheck className="w-5 h-5 text-green-400" />, color: "text-green-600" },
          { label: "En proceso", value: enProceso, icon: <UserCheck className="w-5 h-5 text-blue-400" />, color: "text-blue-600" },
          { label: "Bot activo", value: botActivos, icon: <Bot className="w-5 h-5 text-orange-400" />, color: "text-orange-600" },
          { label: "Agente humano", value: botHumano, icon: <UserX className="w-5 h-5 text-purple-400" />, color: "text-purple-600" },
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

      {/* Search + Filters */}
      <div className="flex items-center gap-4 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
          />
        </div>

        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Lista de contactos</p>
          <p className="text-xs text-gray-400">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Cliente</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Contacto</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Cédula</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Plan</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Estado</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Bot</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors cursor-pointer"
                >
                  {/* Cliente */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm flex-shrink-0">
                        {client.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{client.name}</p>
                        <p className="text-xs text-gray-400">desde {formatDate(client.since)}</p>
                      </div>
                    </div>
                  </td>

                  {/* Contacto */}
                  <td className="px-4 py-3.5">
                    <p className="text-sm text-gray-700">{client.phone}</p>
                    <p className="text-xs text-gray-400">{client.email}</p>
                  </td>

                  {/* Cédula */}
                  <td className="px-4 py-3.5">
                    <p className="text-sm text-gray-600 font-mono">{client.cedula}</p>
                  </td>

                  {/* Plan */}
                  <td className="px-4 py-3.5">
                    <p className="text-sm text-gray-700">{client.plan}</p>
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${leadColors[client.leadState]}`}>
                      {leadStateLabels[client.leadState]}
                    </span>
                  </td>

                  {/* Bot */}
                  <td className="px-4 py-3.5">
                    <BotIndicator status={client.botStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No se encontraron clientes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BotIndicator({ status }: { status: BotStatus }) {
  if (status === "activo") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 bg-green-500 rounded-full" />
        <Bot className="w-3.5 h-3.5 text-green-600" />
        <span className="text-xs font-semibold text-green-700">Activo</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 bg-orange-400 rounded-full" />
      <User className="w-3.5 h-3.5 text-orange-600" />
      <span className="text-xs font-semibold text-orange-700">Humano</span>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-CO", { month: "short", year: "numeric" });
}
