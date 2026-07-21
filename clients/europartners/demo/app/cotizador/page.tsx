"use client";

import { useState, useMemo } from "react";
import { Search, Plus, Trash2, FileText, X, CheckCircle } from "lucide-react";
import productosData from "@/data/productos.json";
import clientesData from "@/data/clientes.json";

const FLETE = 3200;
const CBM = 65;
const ARANCEL = 0.10;
const MARGEN = 0.35;
const CBM_UNIT = 0.5;

function calcPrecio(fob: number) {
  const fleteProrr = (FLETE / CBM) * CBM_UNIT;
  const aduana = fob * ARANCEL;
  return (fob + fleteProrr + aduana) * (1 + MARGEN);
}

type LineaCot = {
  producto: typeof productosData[0];
  cantidad: number;
};

type Cotizacion = {
  numero: string;
  cliente: typeof clientesData[0];
  lineas: LineaCot[];
  total: number;
  fecha: string;
};

let cotNum = 1;

export default function CotizadorPage() {
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [lineas, setLineas] = useState<LineaCot[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [showPreview, setShowPreview] = useState<Cotizacion | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const cliente = clientesData.find((c) => c.id === clienteId) ?? null;

  const resultadosBusqueda = useMemo(() => {
    if (!busqueda || busqueda.length < 2) return [];
    return productosData
      .filter(
        (p) =>
          p.estado === "Activo" &&
          (p.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
            p.codigoInterno.toLowerCase().includes(busqueda.toLowerCase()))
      )
      .slice(0, 6);
  }, [busqueda]);

  function agregarProducto(p: typeof productosData[0]) {
    if (lineas.find((l) => l.producto.id === p.id)) return;
    setLineas([...lineas, { producto: p, cantidad: 1 }]);
    setBusqueda("");
  }

  function cambiarCantidad(id: number, cant: number) {
    setLineas(lineas.map((l) => (l.producto.id === id ? { ...l, cantidad: Math.max(1, cant) } : l)));
  }

  function eliminar(id: number) {
    setLineas(lineas.filter((l) => l.producto.id !== id));
  }

  const total = lineas.reduce((acc, l) => acc + calcPrecio(l.producto.precioFOB) * l.cantidad, 0);

  function generarCotizacion() {
    if (!cliente || lineas.length === 0) return;
    const cot: Cotizacion = {
      numero: `EP-COT-${String(cotNum++).padStart(4, "0")}`,
      cliente,
      lineas: [...lineas],
      total,
      fecha: new Date().toLocaleDateString("es-PA"),
    };
    setCotizaciones([cot, ...cotizaciones]);
    setShowPreview(cot);
    setLineas([]);
    setClienteId(null);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold px-2 py-0.5 rounded text-white" style={{ background: "#7A5F1E" }}>03</span>
          <h1 className="text-2xl font-bold" style={{ color: "#1E3A5F" }}>Cotizador Automático</h1>
        </div>
        <p className="text-gray-500 text-sm">
          Selecciona el cliente, agrega los productos y genera la cotización en PDF. Sin teclear precios.
        </p>
      </div>

      {showSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-700 text-sm font-medium">
          <CheckCircle size={16} /> Cotización generada y guardada en el historial.
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Formulario */}
        <div className="col-span-2 space-y-4">
          {/* Cliente */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Cliente</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              value={clienteId ?? ""}
              onChange={(e) => setClienteId(Number(e.target.value) || null)}
            >
              <option value="">— Seleccionar cliente —</option>
              {clientesData.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.tipo})
                </option>
              ))}
            </select>
            {cliente && (
              <div className="mt-3 p-3 bg-blue-50 rounded-xl text-sm">
                <p className="font-semibold text-blue-800">{cliente.contacto}</p>
                <p className="text-blue-600">{cliente.email} · {cliente.telefono}</p>
                <p className="text-blue-500 text-xs mt-1">
                  Historial: ${cliente.historialCompras.toLocaleString()} en compras
                </p>
              </div>
            )}
          </div>

          {/* Buscador de productos */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Agregar productos</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o código..."
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            {resultadosBusqueda.length > 0 && (
              <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                {resultadosBusqueda.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => agregarProducto(p)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 transition-colors text-left border-b border-gray-50 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{p.descripcion}</p>
                      <p className="text-xs text-gray-400">{p.codigoInterno} · {p.categoria}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-600">${calcPrecio(p.precioFOB).toFixed(2)}</span>
                      <Plus size={16} className="text-blue-500" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Líneas de cotización */}
          {lineas.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <span className="font-semibold text-gray-800 text-sm">Productos en cotización</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr style={{ background: "#F8F9FB" }}>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Producto</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500">Cant.</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Precio Unit.</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Subtotal</th>
                    <th className="px-4 py-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => {
                    const precio = calcPrecio(l.producto.precioFOB);
                    return (
                      <tr key={l.producto.id} className="border-b border-gray-50">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-800">{l.producto.descripcion}</p>
                          <p className="text-xs font-mono text-gray-400">{l.producto.codigoInterno}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min={1}
                            value={l.cantidad}
                            onChange={(e) => cambiarCantidad(l.producto.id, Number(e.target.value))}
                            className="w-16 text-center border border-gray-200 rounded-lg py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-200"
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">${precio.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-bold text-sm" style={{ color: "#1E3A5F" }}>
                          ${(precio * l.cantidad).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => eliminar(l.producto.id)}>
                            <Trash2 size={14} className="text-red-400 hover:text-red-600" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#F8F9FB" }}>
                    <td colSpan={3} className="px-4 py-3 text-right text-sm font-bold text-gray-700">Total</td>
                    <td className="px-4 py-3 text-right text-lg font-black" style={{ color: "#1E3A5F" }}>
                      ${total.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              <div className="px-5 py-4 border-t border-gray-100">
                <button
                  onClick={generarCotizacion}
                  disabled={!cliente}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                  style={{ background: "#1E3A5F" }}
                >
                  <FileText size={16} />
                  Generar Cotización PDF
                </button>
                {!cliente && <p className="text-xs text-red-400 mt-1">Selecciona un cliente primero.</p>}
              </div>
            </div>
          )}
        </div>

        {/* Historial */}
        <div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <span className="font-semibold text-gray-800 text-sm">Historial de cotizaciones</span>
            </div>
            {cotizaciones.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                Genera tu primera cotización para verla aquí.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {cotizaciones.map((c) => (
                  <button
                    key={c.numero}
                    onClick={() => setShowPreview(c)}
                    className="w-full px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-xs font-mono font-bold" style={{ color: "#1E3A5F" }}>{c.numero}</p>
                    <p className="text-sm font-medium text-gray-700 truncate">{c.cliente.nombre}</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-gray-400">{c.fecha}</span>
                      <span className="text-sm font-bold text-gray-700">${c.total.toFixed(2)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Preview */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-8">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            {/* PDF Header */}
            <div className="p-6 text-white" style={{ background: "#1E3A5F" }}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: "#D4A017", color: "#1E3A5F" }}>
                      EP
                    </div>
                    <span className="font-bold text-lg">EUROPARTNERS</span>
                  </div>
                  <p className="text-white/60 text-xs">Materiales y acabados para construcción</p>
                  <p className="text-white/60 text-xs">egispty.com · Panamá</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-lg" style={{ color: "#D4A017" }}>{showPreview.numero}</p>
                  <p className="text-white/70 text-sm">Fecha: {showPreview.fecha}</p>
                </div>
              </div>
            </div>

            {/* Cliente */}
            <div className="px-6 py-4 border-b" style={{ background: "#F8F9FB" }}>
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Cliente</p>
              <p className="font-bold text-gray-800">{showPreview.cliente.nombre}</p>
              <p className="text-sm text-gray-600">Attn: {showPreview.cliente.contacto} · {showPreview.cliente.email}</p>
            </div>

            {/* Líneas */}
            <div className="px-6 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="pb-2 text-left text-xs text-gray-500 font-semibold uppercase">Descripción</th>
                    <th className="pb-2 text-center text-xs text-gray-500 font-semibold uppercase">Cant.</th>
                    <th className="pb-2 text-right text-xs text-gray-500 font-semibold uppercase">Precio Unit.</th>
                    <th className="pb-2 text-right text-xs text-gray-500 font-semibold uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {showPreview.lineas.map((l) => {
                    const precio = calcPrecio(l.producto.precioFOB);
                    return (
                      <tr key={l.producto.id} className="border-b border-gray-100">
                        <td className="py-2.5">
                          <p className="font-medium text-gray-800">{l.producto.descripcion}</p>
                          <p className="text-xs text-gray-400">{l.producto.codigoInterno}</p>
                        </td>
                        <td className="py-2.5 text-center text-gray-600">{l.cantidad}</td>
                        <td className="py-2.5 text-right text-gray-600">${precio.toFixed(2)}</td>
                        <td className="py-2.5 text-right font-bold text-gray-800">${(precio * l.cantidad).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="pt-4 text-right font-bold text-gray-700">TOTAL USD</td>
                    <td className="pt-4 text-right text-xl font-black" style={{ color: "#1E3A5F" }}>
                      ${showPreview.total.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 text-xs text-gray-400">
              Cotización válida por 15 días · Precios en USD · FOB Panamá
            </div>

            <div className="px-6 pb-5 flex justify-end">
              <button
                onClick={() => setShowPreview(null)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
              >
                <X size={14} /> Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
