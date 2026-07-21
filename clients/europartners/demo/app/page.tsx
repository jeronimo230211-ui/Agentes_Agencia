import Link from "next/link";
import { BookOpen, DollarSign, FileText, Receipt, ArrowRight, CheckCircle } from "lucide-react";

const modules = [
  {
    href: "/catalogo",
    number: "01",
    title: "Catálogo de Productos",
    description: "Todos tus productos organizados y buscables en segundos. Adiós a los PDFs perdidos.",
    icon: BookOpen,
    color: "#1E3A5F",
    benefit: "6 categorías · búsqueda instantánea",
  },
  {
    href: "/precios",
    number: "02",
    title: "Motor de Precios",
    description: "El sistema calcula el precio de venta automáticamente cuando cambia el flete, FOB o margen.",
    icon: DollarSign,
    color: "#1E6B5F",
    benefit: "Cero errores por precios desactualizados",
  },
  {
    href: "/cotizador",
    number: "03",
    title: "Cotizador Automático",
    description: "Seleccionas el cliente, buscas los productos y listo. Cotización en PDF en 2 minutos.",
    icon: FileText,
    color: "#7A5F1E",
    benefit: "De 30 min a 2 min por cotización",
  },
  {
    href: "/facturador",
    number: "04",
    title: "Facturador + Dashboard",
    description: "La cotización aprobada se convierte en factura con 1 clic. Panel con todo en tiempo real.",
    icon: Receipt,
    color: "#5F1E3A",
    benefit: "Sin re-digitación · sin facturas perdidas",
  },
];

export default function Home() {
  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-10">
        <div
          className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-3 text-white"
          style={{ background: "#D4A017" }}
        >
          DEMO INTERACTIVO — NEXORA IA
        </div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: "#1E3A5F" }}>
          Sistema de Gestión Europartners
        </h1>
        <p className="text-gray-500 text-base max-w-xl">
          Lo que vamos a construir para que la operación funcione sola —
          catálogo, precios, cotizaciones y facturas, todo conectado.
        </p>
      </div>

      {/* Antes / Después */}
      <div className="grid grid-cols-2 gap-4 mb-10 max-w-2xl">
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
          <p className="text-red-600 font-semibold text-sm mb-3">
            HOY — Sin el sistema
          </p>
          <ul className="space-y-2">
            {[
              "PDFs dispersos sin buscar",
              "Precios calculados a mano",
              "Cotizaciones en 30+ minutos",
              "Facturas re-digitadas desde cero",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-red-700">
                <span className="text-red-400 font-bold">✕</span> {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
          <p className="text-green-600 font-semibold text-sm mb-3">
            CON EL SISTEMA
          </p>
          <ul className="space-y-2">
            {[
              "Todo en un lugar, búsqueda instantánea",
              "Precios actualizados automáticamente",
              "Cotización en 2 minutos",
              "Factura generada con 1 clic",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Módulos */}
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Explora los 4 módulos
      </h2>
      <div className="grid grid-cols-2 gap-5">
        {modules.map(({ href, number, title, description, icon: Icon, color, benefit }) => (
          <Link key={href} href={href} className="group block">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                    style={{ background: color }}
                  >
                    <Icon size={20} />
                  </div>
                  <span className="text-3xl font-black text-gray-100">{number}</span>
                </div>
                <ArrowRight
                  size={18}
                  className="text-gray-300 group-hover:text-gray-500 transition-colors mt-1"
                />
              </div>
              <h3 className="font-bold text-base mb-1" style={{ color: "#1E3A5F" }}>
                {title}
              </h3>
              <p className="text-gray-500 text-sm mb-3">{description}</p>
              <div
                className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block"
                style={{ background: "#FFF8E7", color: "#A07A10" }}
              >
                {benefit}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
