"use client";

import { useState } from "react";
import { templates, templateCategoryLabels, Template } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText, Send, Plus, Search, X, Megaphone,
  Wrench, CreditCard, Bell, TrendingUp,
} from "lucide-react";

const categoryColors: Record<Template["category"], string> = {
  soporte: "bg-blue-50 text-blue-600 border-blue-100",
  facturacion: "bg-purple-50 text-purple-600 border-purple-100",
  recordatorio: "bg-orange-50 text-orange-600 border-orange-100",
  marketing: "bg-green-50 text-green-600 border-green-100",
};

const categoryIcons: Record<Template["category"], React.ReactNode> = {
  soporte: <Wrench className="w-3.5 h-3.5" />,
  facturacion: <CreditCard className="w-3.5 h-3.5" />,
  recordatorio: <Bell className="w-3.5 h-3.5" />,
  marketing: <Megaphone className="w-3.5 h-3.5" />,
};

const filterTabs: { id: Template["category"] | "todas"; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "recordatorio", label: "Recordatorio" },
  { id: "soporte", label: "Soporte" },
  { id: "facturacion", label: "Facturación" },
  { id: "marketing", label: "Marketing" },
];

export default function PlantillasPage() {
  const [filter, setFilter] = useState<Template["category"] | "todas">("todas");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<Template | null>(null);

  const filtered = templates.filter((t) => {
    const matchesFilter = filter === "todas" || t.category === filter;
    const matchesSearch =
      search === "" || t.name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalUses = templates.reduce((sum, t) => sum + t.usedCount, 0);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plantillas de mensajes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Mensajes predefinidos para envíos masivos por WhatsApp a tus clientes.
          </p>
        </div>
        <button className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <Plus className="w-4 h-4" />
          Nueva plantilla
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total plantillas", value: templates.length, icon: <FileText className="w-5 h-5 text-gray-400" />, color: "text-gray-700" },
          { label: "Envíos totales", value: totalUses, icon: <Send className="w-5 h-5 text-blue-400" />, color: "text-blue-600" },
          { label: "Categorías", value: 4, icon: <TrendingUp className="w-5 h-5 text-purple-400" />, color: "text-purple-600" },
          { label: "Más usada", value: "Facturas", icon: <Megaphone className="w-5 h-5 text-green-400" />, color: "text-green-600" },
        ].map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              {stat.icon}
              <div>
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info banner */}
      <div className="mb-5 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
        <Send className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          <span className="font-semibold">¿Cómo funcionan?</span> Las plantillas permiten enviar mensajes masivos a grupos de clientes por WhatsApp Business.
          Ideal para avisos de mantenimiento, recordatorios de pago, o campañas de actualización de plan.
          Los campos entre {"{{"}{"}}"} se reemplazan automáticamente con los datos de cada cliente.
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-4 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar plantilla..."
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

      {/* Templates grid */}
      <div className="grid grid-cols-2 gap-4">
        {filtered.map((tpl) => (
          <Card
            key={tpl.id}
            className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setPreview(tpl)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${categoryColors[tpl.category]}`}>
                  {categoryIcons[tpl.category]}
                  {templateCategoryLabels[tpl.category]}
                </span>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-700">{tpl.usedCount}</p>
                  <p className="text-xs text-gray-400">envíos</p>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-gray-900 mb-2">{tpl.name}</h3>

              <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 font-mono bg-gray-50 rounded-lg p-2">
                {tpl.message}
              </p>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {tpl.lastUsed ? `Último uso: ${tpl.lastUsed}` : "Sin usos registrados"}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setPreview(tpl); }}
                  className="flex items-center gap-1 text-xs text-orange-500 font-semibold hover:text-orange-700"
                >
                  <Send className="w-3.5 h-3.5" />
                  Usar plantilla
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${categoryColors[preview.category]}`}>
                  {categoryIcons[preview.category]}
                  {templateCategoryLabels[preview.category]}
                </span>
                <h2 className="text-base font-bold text-gray-900">{preview.name}</h2>
              </div>
              <button onClick={() => setPreview(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mensaje</p>
                <div className="bg-[#E5DDD5] rounded-xl p-4">
                  <div className="bg-white rounded-xl px-4 py-3 shadow-sm max-w-[85%]">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{preview.message}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Variables automáticas</p>
                <div className="flex flex-wrap gap-2">
                  {(preview.message.match(/\{\{[^}]+\}\}/g) || []).map((v) => (
                    <span key={v} className="px-2.5 py-1 bg-orange-50 border border-orange-100 rounded-lg text-xs font-mono text-orange-600">
                      {v}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Send className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs font-semibold text-gray-700">{preview.usedCount} envíos realizados</p>
                  {preview.lastUsed && (
                    <p className="text-xs text-gray-400">Último: {preview.lastUsed}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={() => setPreview(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
              >
                Cerrar
              </button>
              <button className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />
                Enviar a clientes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
