"use client";

import { useState, useMemo } from "react";
import { RefreshCw, AlertTriangle, TrendingUp } from "lucide-react";
import productosData from "@/data/productos.json";

const CBM_CONTENEDOR = 65; // CBM por contenedor

function calcPrecioVenta(fob: number, flete: number, arancel: number, margen: number, cbm: number) {
  const fleteProrr = (flete / CBM_CONTENEDOR) * cbm;
  const aduana = fob * (arancel / 100);
  return (fob + fleteProrr + aduana) * (1 + margen / 100);
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-bold" style={{ color: "#1E3A5F" }}>{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-800"
      />
      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

export default function PreciosPage() {
  const [flete, setFlete] = useState(3200);
  const [arancel, setArancel] = useState(10);
  const [margen, setMargen] = useState(35);
  const [cbmUnit, setCbmUnit] = useState(0.5);

  const muestra = useMemo(
    () =>
      productosData
        .filter((p) => p.estado === "Activo")
        .slice(0, 10)
        .map((p) => ({
          ...p,
          precioVenta: calcPrecioVenta(p.precioFOB, flete, arancel, margen, cbmUnit),
          fleteProrr: (flete / CBM_CONTENEDOR) * cbmUnit,
          aduana: p.precioFOB * (arancel / 100),
        })),
    [flete, arancel, margen, cbmUnit]
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold px-2 py-0.5 rounded text-white" style={{ background: "#1E6B5F" }}>02</span>
          <h1 className="text-2xl font-bold" style={{ color: "#1E3A5F" }}>Motor de Precios</h1>
        </div>
        <p className="text-gray-500 text-sm">
          Ajusta las variables y mira cómo todos los precios se recalculan en tiempo real.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Panel de variables */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <RefreshCw size={16} style={{ color: "#D4A017" }} />
            <h2 className="font-bold text-gray-800">Variables de precio</h2>
          </div>

          <div className="p-3 rounded-xl mb-5 text-sm" style={{ background: "#F0F8FF", border: "1px solid #DBEAFE" }}>
            <p className="font-semibold text-blue-800 mb-1">Fórmula</p>
            <p className="font-mono text-xs text-blue-700">
              Precio = (FOB + flete + arancel) × (1 + margen)
            </p>
          </div>

          <Slider
            label="Flete marítimo (contenedor 40')"
            value={flete}
            min={1500}
            max={6000}
            step={100}
            onChange={setFlete}
            format={(v) => `$${v.toLocaleString()}`}
          />
          <Slider
            label="Arancel de importación"
            value={arancel}
            min={0}
            max={25}
            step={1}
            onChange={setArancel}
            format={(v) => `${v}%`}
          />
          <Slider
            label="Margen de ganancia"
            value={margen}
            min={10}
            max={80}
            step={5}
            onChange={setMargen}
            format={(v) => `${v}%`}
          />
          <Slider
            label="CBM promedio por producto"
            value={cbmUnit}
            min={0.1}
            max={2}
            step={0.1}
            onChange={setCbmUnit}
            format={(v) => `${v} m³`}
          />

          <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-xs text-amber-700 font-semibold mb-1">Flete prorrateado por producto</p>
            <p className="text-lg font-bold text-amber-800">
              ${((flete / CBM_CONTENEDOR) * cbmUnit).toFixed(2)} / unidad
            </p>
          </div>
        </div>

        {/* Tabla de precios */}
        <div className="col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} style={{ color: "#1E3A5F" }} />
                <span className="font-semibold text-gray-800">Tabla de precios actualizada</span>
              </div>
              <span className="text-xs text-gray-400">Recalculando automáticamente →</span>
            </div>
            <table className="w-full">
              <thead>
                <tr style={{ background: "#F8F9FB" }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Producto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">FOB</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">+ Flete</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">+ Arancel</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Precio Venta</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Alerta</th>
                </tr>
              </thead>
              <tbody>
                {muestra.map((p) => (
                  <tr key={p.id} className={`border-b border-gray-50 ${p.diasSinActualizar > 60 ? "bg-orange-50/40" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-800 truncate max-w-[180px]">{p.descripcion}</p>
                      <p className="text-xs font-mono text-gray-400">{p.codigoInterno}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">${p.precioFOB.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-sm text-blue-600">+${p.fleteProrr.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-sm text-purple-600">+${p.aduana.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-sm" style={{ color: "#1E3A5F" }}>
                        ${p.precioVenta.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.diasSinActualizar > 60 ? (
                        <span className="flex items-center justify-end gap-1 text-orange-500 text-xs">
                          <AlertTriangle size={12} /> {p.diasSinActualizar}d
                        </span>
                      ) : (
                        <span className="text-green-500 text-xs">✓ OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2 px-1">
            Mostrando 10 productos activos de muestra. El sistema real incluye todos los {productosData.length} productos.
          </p>
        </div>
      </div>
    </div>
  );
}
