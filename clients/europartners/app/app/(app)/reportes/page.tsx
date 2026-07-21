'use client'

import { useState, useEffect, useMemo } from 'react'
import { BarChart3, RefreshCw } from 'lucide-react'

interface Fila {
  usuario_id: string
  nombre: string
  etapa: string
  promedio_horas: number
  muestras: number
}

function fechaLabel(horas: number) {
  if (horas < 24) return `${horas.toFixed(1)} h`
  return `${(horas / 24).toFixed(1)} días`
}

export default function ReportesPage() {
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtroEtapa, setFiltroEtapa] = useState('')

  useEffect(() => {
    fetch('/api/reportes/tiempos-por-usuario')
      .then(r => r.json())
      .then(({ data }) => setFilas(data || []))
      .finally(() => setCargando(false))
  }, [])

  const usuarios = useMemo(() => Array.from(new Set(filas.map(f => f.nombre))), [filas])
  const etapas = useMemo(() => Array.from(new Set(filas.map(f => f.etapa))), [filas])

  const filtradas = filas.filter(f =>
    (!filtroUsuario || f.nombre === filtroUsuario) &&
    (!filtroEtapa || f.etapa === filtroEtapa)
  )

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F] mb-1 flex items-center gap-2">
          <BarChart3 size={22} className="text-[#D4A017]" />
          Reportes — Tiempo por persona
        </h1>
        <p className="text-gray-500 text-sm">
          Promedio de horas que tarda cada persona en actuar sobre cada etapa de una proforma, a partir del historial de transiciones (proforma_eventos).
        </p>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
          value={filtroUsuario}
          onChange={e => setFiltroUsuario(e.target.value)}
        >
          <option value="">Todas las personas</option>
          {usuarios.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
          value={filtroEtapa}
          onChange={e => setFiltroEtapa(e.target.value)}
        >
          <option value="">Todas las etapas</option>
          {etapas.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-3" />
          Cargando...
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p>Aún no hay suficientes datos de transiciones para reportar.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left p-4 font-medium text-gray-500">Persona</th>
                <th className="text-left p-4 font-medium text-gray-500">Etapa</th>
                <th className="text-right p-4 font-medium text-gray-500">Promedio</th>
                <th className="text-right p-4 font-medium text-gray-500">Muestras</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((f, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-800">{f.nombre}</td>
                  <td className="p-4 text-gray-600">{f.etapa}</td>
                  <td className="p-4 text-right font-bold text-[#1E3A5F]">{fechaLabel(f.promedio_horas)}</td>
                  <td className="p-4 text-right text-gray-400">{f.muestras}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
