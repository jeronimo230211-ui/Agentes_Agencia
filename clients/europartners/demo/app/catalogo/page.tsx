"use client";

import { useState } from "react";
import { Search, Filter, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import productosData from "@/data/productos.json";

const categorias = ["Todas", "Sanitarios", "Griferías", "Puertas", "Espejos", "Cabinas de Baño", "Gypsum"];

type Producto = typeof productosData[0];

function BadgeEstado({ estado }: { estado: string }) {
  if (estado === "Activo") return <span className="ep-badge-activo">Activo</span>;
  if (estado === "Descontinuado") return <span className="ep-badge-descontinuado">Descontinuado</span>;
  return <span className="ep-badge-pendiente">Pendiente</span>;
}

function ProductRow({ p }: { p: Producto }) {
  const [open, setOpen] = useState(false);
  const stale = p.diasSinActualizar > 60;

  return (
    <>
      <tr
        className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${stale ? "bg-orange-50/50" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-600">{p.codigoInterno}</td>
        <td className="px-4 py-3 text-xs text-gray-400">{p.codigoProveedor}</td>
        <td className="px-4 py-3 text-sm font-medium text-gray-800">{p.descripcion}</td>
        <td className="px-4 py-3">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#EEF2FF", color: "#3730A3" }}>
            {p.categoria}
          </span>
        </td>
        <td className="px-4 py-3 text-sm font-bold text-gray-700">${p.precioFOB.toFixed(2)}</td>
        <td className="px-4 py-3">
          <BadgeEstado estado={p.estado} />
        </td>
        <td className="px-4 py-3">
          {stale ? (
            <span className="flex items-center gap-1 text-orange-500 text-xs font-medium">
              <AlertTriangle size={12} /> {p.diasSinActualizar}d sin actualizar
            </span>
          ) : (
            <span className="text-gray-400 text-xs">{p.diasSinActualizar}d</span>
          )}
        </td>
        <td className="px-4 py-3 text-gray-400">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </td>
      </tr>
      {open && (
        <tr className="bg-blue-50/40 border-b border-blue-100">
          <td colSpan={8} className="px-6 py-4">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-gray-400 mb-1 font-semibold uppercase">Características</p>
                <p className="text-sm text-gray-700">{p.caracteristicas}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1 font-semibold uppercase">Códigos</p>
                <p className="text-sm">
                  <span className="font-semibold text-gray-600">Interno:</span>{" "}
                  <span className="font-mono text-xs">{p.codigoInterno}</span>
                </p>
                <p className="text-sm">
                  <span className="font-semibold text-gray-600">Proveedor:</span>{" "}
                  <span className="font-mono text-xs">{p.codigoProveedor}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1 font-semibold uppercase">Última actualización</p>
                <p className="text-sm text-gray-700">{p.ultimaActualizacion}</p>
                {stale && (
                  <p className="text-xs text-orange-500 mt-1 font-medium">
                    ⚠ Precio podría estar desactualizado
                  </p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function CatalogoPage() {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("Todas");

  const productos = productosData.filter((p) => {
    const matchCat = categoria === "Todas" || p.categoria === categoria;
    const matchSearch =
      p.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.codigoInterno.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.codigoProveedor.toLowerCase().includes(busqueda.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold px-2 py-0.5 rounded text-white" style={{ background: "#1E3A5F" }}>01</span>
          <h1 className="text-2xl font-bold" style={{ color: "#1E3A5F" }}>Catálogo de Productos</h1>
        </div>
        <p className="text-gray-500 text-sm">
          {productosData.length} referencias cargadas · Haz clic en cualquier fila para ver detalles
        </p>
      </div>

      {/* Antes / Ahora banner */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="text-sm text-red-500 font-medium px-3 py-1.5 bg-red-50 rounded-lg">
          Antes: 6 PDFs dispersos imposibles de buscar
        </div>
        <span className="text-gray-300 text-xl">→</span>
        <div className="text-sm text-green-600 font-medium px-3 py-1.5 bg-green-50 rounded-lg">
          Ahora: todo aquí, buscable en segundos
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, código interno o proveedor..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <div className="flex gap-1.5">
            {categorias.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoria(cat)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  categoria === cat
                    ? "text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={categoria === cat ? { background: "#1E3A5F" } : {}}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ background: "#F8F9FB" }}>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cód. Interno</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cód. Proveedor</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Descripción</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Categoría</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Precio FOB</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actualización</th>
              <th className="px-4 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {productos.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No se encontraron productos con ese criterio.
                </td>
              </tr>
            ) : (
              productos.map((p) => <ProductRow key={p.id} p={p} />)
            )}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
          Mostrando {productos.length} de {productosData.length} referencias
        </div>
      </div>
    </div>
  );
}
