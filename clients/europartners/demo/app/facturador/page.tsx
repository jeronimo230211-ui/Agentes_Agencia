"use client";

import { useState } from "react";
import { CheckCircle, Clock, XCircle, FileText, BarChart3, TrendingUp, DollarSign, X } from "lucide-react";

type Status = "Pendiente" | "Aprobada" | "Rechazada" | "Facturada";

type Cotizacion = {
  id: string;
  numero: string;
  cliente: string;
  fecha: string;
  total: number;
  status: Status;
  productos: string[];
};

const cotizacionesIniciales: Cotizacion[] = [
  { id: "1", numero: "EP-COT-0001", cliente: "Condominios Bahía Verde", fecha: "2026-06-15", total: 8450.00, status: "Aprobada", productos: ["Cabina Walk-In 120cm x6", "Mezcladora Ducha Termostato x6", "Espejo LED Redondo x6"] },
  { id: "2", numero: "EP-COT-0002", cliente: "Hotel Pacífico Boutique", fecha: "2026-06-14", total: 12200.00, status: "Aprobada", productos: ["Inodoro Compacto Suspendido x20", "Mezcladora Monomando Cromo x20", "Espejo Con Repisa x20"] },
  { id: "3", numero: "EP-COT-0003", cliente: "Constructora Miramar S.A.", fecha: "2026-06-12", total: 3100.00, status: "Pendiente", productos: ["Puerta WPC Interior x10", "Inodoro Alargado x5"] },
  { id: "4", numero: "EP-COT-0004", cliente: "Arq. Patricia Núñez", fecha: "2026-06-10", total: 1750.00, status: "Rechazada", productos: ["Cabina Circular Hidromasaje x2", "Espejo Inteligente Touch x2"] },
  { id: "5", numero: "EP-COT-0005", cliente: "Acabados Premium Panamá", fecha: "2026-06-08", total: 5600.00, status: "Pendiente", productos: ["Panel Yeso Estándar x200", "Panel Yeso Humedad x100", "Perfil Canal U x150"] },
  { id: "6", numero: "EP-COT-0006", cliente: "Ferretería La Central", fecha: "2026-06-05", total: 2340.00, status: "Aprobada", productos: ["Llave Cocina Extraíble x20", "Mezcladora Monomando x15"] },
];

let factNum = 1;

type Factura = {
  numero: string;
  cotizacion: string;
  cliente: string;
  total: number;
  fechaEmision: string;
  fechaVencimiento: string;
  estadoPago: "Pendiente" | "Pagada";
};

const facturasIniciales: Factura[] = [
  { numero: "EP-FAC-0001", cotizacion: "EP-COT-0007", cliente: "Proyectos Residenciales Torres", total: 18400.00, fechaEmision: "2026-05-20", fechaVencimiento: "2026-06-20", estadoPago: "Pagada" },
  { numero: "EP-FAC-0002", cotizacion: "EP-COT-0008", cliente: "Diseño & Espacio Interior", total: 3200.00, fechaEmision: "2026-06-01", fechaVencimiento: "2026-07-01", estadoPago: "Pendiente" },
];

function BadgeStatus({ status }: { status: Status }) {
  const map: Record<Status, { bg: string; text: string; icon: React.ReactNode }> = {
    Pendiente: { bg: "bg-yellow-50 text-yellow-700 border border-yellow-100", text: "Pendiente", icon: <Clock size={12} /> },
    Aprobada: { bg: "bg-green-50 text-green-700 border border-green-100", text: "Aprobada", icon: <CheckCircle size={12} /> },
    Rechazada: { bg: "bg-red-50 text-red-600 border border-red-100", text: "Rechazada", icon: <XCircle size={12} /> },
    Facturada: { bg: "bg-blue-50 text-blue-700 border border-blue-100", text: "Facturada", icon: <FileText size={12} /> },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${s.bg}`}>
      {s.icon} {s.text}
    </span>
  );
}

export default function FacturadorPage() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>(cotizacionesIniciales);
  const [facturas, setFacturas] = useState<Factura[]>(facturasIniciales);
  const [showFactura, setShowFactura] = useState<Factura | null>(null);

  function generarFactura(cot: Cotizacion) {
    const nueva: Factura = {
      numero: `EP-FAC-${String(factNum++ + 2).padStart(4, "0")}`,
      cotizacion: cot.numero,
      cliente: cot.cliente,
      total: cot.total,
      fechaEmision: new Date().toLocaleDateString("es-PA"),
      fechaVencimiento: new Date(Date.now() + 30 * 86400000).toLocaleDateString("es-PA"),
      estadoPago: "Pendiente",
    };
    setFacturas([nueva, ...facturas]);
    setCotizaciones(cotizaciones.map((c) => c.id === cot.id ? { ...c, status: "Facturada" as Status } : c));
    setShowFactura(nueva);
  }

  function marcarPagada(num: string) {
    setFacturas(facturas.map((f) => f.numero === num ? { ...f, estadoPago: "Pagada" } : f));
    if (showFactura?.numero === num) setShowFactura({ ...showFactura, estadoPago: "Pagada" });
  }

  const totalPendiente = facturas.filter((f) => f.estadoPago === "Pendiente").reduce((a, f) => a + f.total, 0);
  const totalCobrado = facturas.filter((f) => f.estadoPago === "Pagada").reduce((a, f) => a + f.total, 0);
  const aprobadas = cotizaciones.filter((c) => c.status === "Aprobada" || c.status === "Facturada").length;
  const totalCots = cotizaciones.length;
  const tasa = Math.round((aprobadas / totalCots) * 100);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold px-2 py-0.5 rounded text-white" style={{ background: "#5F1E3A" }}>04</span>
          <h1 className="text-2xl font-bold" style={{ color: "#1E3A5F" }}>Facturador + Dashboard</h1>
        </div>
        <p className="text-gray-500 text-sm">
          Convierte cotizaciones aprobadas en facturas con 1 clic. Todo tu negocio visible en tiempo real.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Cotizaciones este mes", value: totalCots, sub: `${aprobadas} aprobadas`, icon: FileText, color: "#1E3A5F" },
          { label: "Tasa de conversión", value: `${tasa}%`, sub: "Cotización → Factura", icon: TrendingUp, color: "#1E6B5F" },
          { label: "Por cobrar", value: `$${totalPendiente.toLocaleString()}`, sub: "Facturas pendientes", icon: Clock, color: "#D4A017" },
          { label: "Cobrado (mayo-junio)", value: `$${totalCobrado.toLocaleString()}`, sub: "Facturas pagadas", icon: DollarSign, color: "#166534" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: color + "20" }}>
                <Icon size={16} style={{ color }} />
              </div>
            </div>
            <p className="text-2xl font-black" style={{ color }}>{value}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Cotizaciones */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <BarChart3 size={16} style={{ color: "#1E3A5F" }} />
            <span className="font-semibold text-gray-800">Cotizaciones</span>
            <span className="ml-auto text-xs text-gray-400">Clic en &apos;Aprobada&apos; para generar factura</span>
          </div>
          <div className="divide-y divide-gray-50">
            {cotizaciones.map((c) => (
              <div key={c.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-bold text-gray-500">{c.numero}</p>
                    <p className="text-sm font-semibold text-gray-800 truncate">{c.cliente}</p>
                    <p className="text-xs text-gray-400">{c.fecha} · ${c.total.toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <BadgeStatus status={c.status} />
                    {c.status === "Aprobada" && (
                      <button
                        onClick={() => generarFactura(c)}
                        className="text-xs px-3 py-1.5 rounded-lg text-white font-semibold transition-opacity"
                        style={{ background: "#1E3A5F" }}
                      >
                        Generar Factura →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Facturas */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <FileText size={16} style={{ color: "#5F1E3A" }} />
            <span className="font-semibold text-gray-800">Facturas emitidas</span>
          </div>
          <div className="divide-y divide-gray-50">
            {facturas.map((f) => (
              <div key={f.numero} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-bold text-gray-500">{f.numero}</p>
                    <p className="text-sm font-semibold text-gray-800 truncate">{f.cliente}</p>
                    <p className="text-xs text-gray-400">
                      Emitida: {f.fechaEmision} · Vence: {f.fechaVencimiento}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <p className="font-bold text-sm" style={{ color: "#1E3A5F" }}>${f.total.toLocaleString()}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${f.estadoPago === "Pagada" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                      {f.estadoPago}
                    </span>
                    {f.estadoPago === "Pendiente" && (
                      <button
                        onClick={() => marcarPagada(f.numero)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 font-medium"
                      >
                        Marcar pagada
                      </button>
                    )}
                    <button
                      onClick={() => setShowFactura(f)}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      Ver factura
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal factura */}
      {showFactura && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-8">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-5 text-white" style={{ background: "#1E3A5F" }}>
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs" style={{ background: "#D4A017", color: "#1E3A5F" }}>EP</div>
                    <span className="font-bold">EUROPARTNERS</span>
                  </div>
                  <p className="text-white/60 text-xs">Factura de Venta</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold" style={{ color: "#D4A017" }}>{showFactura.numero}</p>
                  <p className="text-white/60 text-xs">Ref: {showFactura.cotizacion}</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Cliente</p>
                <p className="font-bold text-gray-800">{showFactura.cliente}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Fecha de Emisión</p>
                  <p className="text-sm text-gray-700">{showFactura.fechaEmision}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Fecha de Vencimiento</p>
                  <p className="text-sm text-gray-700">{showFactura.fechaVencimiento}</p>
                </div>
              </div>
              <div className="p-4 rounded-xl" style={{ background: "#F8F9FB" }}>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total a pagar (USD)</span>
                  <span className="text-xl font-black" style={{ color: "#1E3A5F" }}>${showFactura.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-gray-400">Estado de pago</span>
                  <span className={`text-xs font-bold ${showFactura.estadoPago === "Pagada" ? "text-green-600" : "text-orange-600"}`}>
                    {showFactura.estadoPago}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                {showFactura.estadoPago === "Pendiente" && (
                  <button
                    onClick={() => marcarPagada(showFactura.numero)}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
                    style={{ background: "#166534" }}
                  >
                    Marcar como Pagada
                  </button>
                )}
                <button
                  onClick={() => setShowFactura(null)}
                  className="flex items-center gap-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
                >
                  <X size={14} /> Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
