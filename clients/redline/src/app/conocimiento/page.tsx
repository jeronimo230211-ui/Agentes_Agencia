"use client";

import { useState } from "react";
import { knowledgeDocs, categoryLabels, KnowledgeDocument } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen, CheckCircle2, Clock, Upload, Plus, Search,
  Tag, FileText, HelpCircle, ShieldCheck, MapPin, Info,
  AlertCircle, X,
} from "lucide-react";

const categoryIcons: Record<KnowledgeDocument["category"], React.ReactNode> = {
  general: <Info className="w-4 h-4" />,
  precios: <Tag className="w-4 h-4" />,
  faq: <HelpCircle className="w-4 h-4" />,
  politicas: <ShieldCheck className="w-4 h-4" />,
  cobertura: <MapPin className="w-4 h-4" />,
};

const categoryColors: Record<KnowledgeDocument["category"], string> = {
  general: "bg-blue-50 text-blue-600 border-blue-100",
  precios: "bg-purple-50 text-purple-600 border-purple-100",
  faq: "bg-yellow-50 text-yellow-600 border-yellow-100",
  politicas: "bg-green-50 text-green-600 border-green-100",
  cobertura: "bg-orange-50 text-orange-600 border-orange-100",
};

const redlineNeeds = [
  {
    category: "general" as const,
    label: "Información General",
    items: [
      "Nombre legal de la empresa y NIT",
      "Dirección de oficinas y horarios de atención",
      "Teléfonos y correos de contacto por área",
      "Historia y valores de la empresa",
    ],
  },
  {
    category: "precios" as const,
    label: "Planes y Precios",
    items: [
      "Nombre y velocidad de cada plan disponible",
      "Precio mensual por plan (sin IVA y con IVA)",
      "Condiciones de contrato (permanencia, instalación)",
      "Disponibilidad de TV y telefonía por plan",
    ],
  },
  {
    category: "faq" as const,
    label: "Preguntas Frecuentes",
    items: [
      "¿Qué hago si no tengo internet? (pasos básicos)",
      "¿Cuánto tarda una visita técnica?",
      "¿Cómo pago mi factura y qué métodos aceptan?",
      "¿Cómo cancelo o cambio mi plan?",
    ],
  },
  {
    category: "cobertura" as const,
    label: "Cobertura",
    items: [
      "Lista de barrios y municipios con fibra óptica",
      "Zonas con radio enlace",
      "Plan de expansión de cobertura 2026",
    ],
  },
  {
    category: "politicas" as const,
    label: "Políticas",
    items: [
      "Tiempo máximo de respuesta a reportes (SLA)",
      "Política de compensación por caídas del servicio",
      "Condiciones de cancelación anticipada",
    ],
  },
];

export default function ConocimientoPage() {
  const [showGuide, setShowGuide] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = knowledgeDocs.filter(
    (d) =>
      search === "" ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.summary.toLowerCase().includes(search.toLowerCase())
  );

  const total = knowledgeDocs.length;
  const synced = knowledgeDocs.filter((d) => d.status === "sincronizado").length;
  const pending = knowledgeDocs.filter((d) => d.status === "pendiente").length;
  const categories = new Set(knowledgeDocs.map((d) => d.category)).size;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Base de Conocimiento</h1>
          <p className="text-sm text-gray-500 mt-1">
            La información que usa Fijo para responder preguntas sin depender de un agente humano.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
          >
            <HelpCircle className="w-4 h-4" />
            Guía
          </button>
          <button className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
            <Upload className="w-4 h-4" />
            Subir archivo
          </button>
          <button className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            <Plus className="w-4 h-4" />
            Nuevo
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total documentos", value: total, icon: <FileText className="w-5 h-5 text-gray-400" />, color: "text-gray-700" },
          { label: "Sincronizados", value: synced, icon: <CheckCircle2 className="w-5 h-5 text-green-400" />, color: "text-green-600" },
          { label: "Pendientes", value: pending, icon: <Clock className="w-5 h-5 text-yellow-400" />, color: "text-yellow-600" },
          { label: "Categorías", value: categories, icon: <Tag className="w-5 h-5 text-blue-400" />, color: "text-blue-600" },
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

      {/* Pending alert */}
      {pending > 0 && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {pending} documento{pending > 1 ? "s" : ""} pendiente{pending > 1 ? "s" : ""} de completar
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Fijo no puede responder preguntas sobre estas categorías hasta que sean completadas por RedLine.
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-xs mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por título o contenido..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
        />
      </div>

      {/* Documents grid */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {filtered.map((doc) => (
          <Card
            key={doc.id}
            className={`border shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
              doc.status === "pendiente" ? "border-dashed border-gray-200" : "border-gray-100"
            }`}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${categoryColors[doc.category]}`}>
                  {categoryIcons[doc.category]}
                  {categoryLabels[doc.category]}
                </span>
                <StatusBadge status={doc.status} />
              </div>

              <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{doc.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{doc.summary}</p>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-gray-400">Actualizado {doc.updatedAt}</span>
                {doc.status === "pendiente" && (
                  <button className="text-xs text-orange-500 font-semibold hover:text-orange-700">
                    Completar →
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* What RedLine needs to provide */}
      <div className="border-t border-gray-100 pt-8">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">¿Qué información necesita RedLine proveer?</h2>
          <p className="text-sm text-gray-500 mt-1">
            Para que Fijo pueda responder autónomamente el 100% de las preguntas de los clientes, RedLine debe completar los siguientes documentos.
            Formatos aceptados: <span className="font-medium">.txt · .md · .pdf · .docx</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {redlineNeeds.map((section) => (
            <Card key={section.category} className={`border shadow-sm ${categoryColors[section.category]}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-1.5 rounded-lg ${categoryColors[section.category]}`}>
                    {categoryIcons[section.category]}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">{section.label}</h3>
                </div>
                <ul className="space-y-1.5">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0 mt-1.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Guide modal */}
      {showGuide && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-orange-500" />
                <h2 className="text-base font-bold text-gray-900">Guía para documentos</h2>
              </div>
              <button onClick={() => setShowGuide(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">Tips para mejores resultados</p>
                <ul className="space-y-1.5">
                  {[
                    "Usa párrafos separados entre secciones para mejor procesamiento",
                    "Escribe como le hablarías a un cliente, sin jerga técnica",
                    "Incluye precios, horarios y datos de contacto actualizados",
                    "El formato pregunta-respuesta funciona muy bien para FAQs",
                  ].map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-blue-700">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Plantillas descargables</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { name: "Planes y Servicios", desc: "Catálogo de precios" },
                    { name: "Preguntas Frecuentes", desc: "Formato Q&A" },
                    { name: "Políticas", desc: "Términos y condiciones" },
                  ].map((tpl) => (
                    <button
                      key={tpl.name}
                      className="border border-gray-200 rounded-xl p-3 text-left hover:border-orange-300 hover:bg-orange-50 transition-colors"
                    >
                      <FileText className="w-5 h-5 text-orange-400 mb-2" />
                      <p className="text-xs font-semibold text-gray-800">{tpl.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{tpl.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Formatos soportados</p>
                <div className="flex gap-2">
                  {[".txt", ".md", ".pdf", ".docx"].map((f) => (
                    <span key={f} className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-mono text-gray-600">{f}</span>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Recomendamos .txt o .md para mejores resultados.</p>
              </div>
            </div>

            <div className="px-5 pb-5">
              <button
                onClick={() => setShowGuide(false)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: KnowledgeDocument["status"] }) {
  if (status === "sincronizado") {
    return (
      <div className="flex items-center gap-1 text-xs font-medium text-green-600">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Sincronizado
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-xs font-medium text-yellow-600">
      <Clock className="w-3.5 h-3.5" />
      Pendiente
    </div>
  );
}
