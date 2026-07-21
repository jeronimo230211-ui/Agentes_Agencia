'use client'
import { useState, useEffect } from 'react'
import { FileText, CheckCircle, Send, Clock, TrendingUp, AlertCircle, DollarSign, Ship, Inbox } from 'lucide-react'
import Link from 'next/link'
import { formatUSD } from '@/lib/precio'
import { supabase } from '@/lib/supabase'
import MisPendientesPanel from '@/components/MisPendientesPanel'
import type { Proforma, Usuario } from '@/types/europartners'

interface KPIs {
  borradores: number
  en_revision: number
  aprobadas: number
  enviadas: number
  recientes: Proforma[]
}

interface StatsCEO {
  facturacion_total: number
  otif: { total_entregados: number; a_tiempo: number; pct: number | null }
  tiempos_por_etapa: { etapa: string; promedio_horas: number; muestras: number }[]
  pipeline: {
    solicitudes_pendientes: number
    proformas: Record<string, number>
    despachos: Record<string, number>
  }
}

interface Cliente { id: string; nombre: string; tipo: string; margen_min: number; margen_max: number }
interface ParametroPrecio { id: string; nombre: string; flete_usd: number; arancel_pct: number; cbm_total_contenedor: number; valido_desde: string }

function fechaLabel(horas: number) {
  if (horas < 24) return `${horas.toFixed(1)} h`
  return `${(horas / 24).toFixed(1)} días`
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs>({ borradores: 0, en_revision: 0, aprobadas: 0, enviadas: 0, recientes: [] })
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<StatsCEO | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [parametros, setParametros] = useState<ParametroPrecio[]>([])
  const [usuario, setUsuario] = useState<Usuario | null>(null)

  useEffect(() => {
    async function cargarUsuario() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase.from('usuarios').select('*').eq('id', session.user.id).single()
      if (data) setUsuario(data as Usuario)
    }
    cargarUsuario()
  }, [])

  useEffect(() => {
    async function cargar() {
      const res = await fetch('/api/proformas?limit=20')
      const { data } = await res.json()
      if (!data) return

      const borradores = data.filter((p: Proforma) => p.estado === 'borrador').length
      const en_revision = data.filter((p: Proforma) => p.estado === 'en_revision').length
      const aprobadas = data.filter((p: Proforma) => p.estado === 'aprobada').length
      const enviadas = data.filter((p: Proforma) => p.estado === 'enviada').length

      setKpis({ borradores, en_revision, aprobadas, enviadas, recientes: data.slice(0, 8) })
      setLoading(false)
    }
    cargar()

    fetch('/api/dashboard/stats').then(r => r.json()).then(setStats)
    fetch('/api/clientes').then(r => r.json()).then(({ data }) => setClientes(data || []))
    fetch('/api/parametros-precio').then(r => r.json()).then(({ data }) => setParametros(data || []))
  }, [])

  const kpiCards = [
    { label: 'Borradores', value: kpis.borradores, icon: FileText, color: 'bg-gray-100 text-gray-600', href: '/cotizador?estado=borrador' },
    { label: 'En revisión', value: kpis.en_revision, icon: Clock, color: 'bg-yellow-100 text-yellow-700', href: '/cotizador?estado=en_revision' },
    { label: 'Aprobadas', value: kpis.aprobadas, icon: CheckCircle, color: 'bg-green-100 text-green-700', href: '/cotizador?estado=aprobada' },
    { label: 'Enviadas', value: kpis.enviadas, icon: Send, color: 'bg-blue-100 text-blue-700', href: '/cotizador?estado=enviada' },
  ]

  const estadoBadge = (estado: string) => {
    const styles: Record<string, string> = {
      borrador:    'bg-gray-100 text-gray-600',
      en_revision: 'bg-yellow-100 text-yellow-700',
      aprobada:    'bg-green-100 text-green-700',
      rechazada:   'bg-red-100 text-red-600',
      enviada:     'bg-blue-100 text-blue-700',
      facturada:   'bg-purple-100 text-purple-700',
    }
    return styles[estado] || 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Resumen de operaciones</p>
      </div>

      {/* Mis Pendientes — lo primero que ve Marta al entrar */}
      {usuario?.rol === 'admin' && <MisPendientesPanel />}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {kpiCards.map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href}>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer">
              <div className={`inline-flex p-2 rounded-lg mb-3 ${color}`}>
                <Icon size={20} />
              </div>
              <p className="text-3xl font-bold text-gray-800">{loading ? '—' : value}</p>
              <p className="text-sm text-gray-500 mt-1">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Alertas genéricas — para no-admin; para admin ya lo cubre Mis Pendientes arriba */}
      {usuario?.rol !== 'admin' && kpis.en_revision > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertCircle size={20} className="text-yellow-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-yellow-800">
              {kpis.en_revision} proforma{kpis.en_revision > 1 ? 's' : ''} esperando aprobación
            </p>
            <Link href="/aprobacion" className="text-yellow-700 underline text-sm">
              Ir a Aprobaciones →
            </Link>
          </div>
        </div>
      )}

      {/* Tabla recientes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp size={18} className="text-[#D4A017]" />
            Proformas recientes
          </h2>
          <Link href="/cotizador" className="text-[#1E3A5F] text-sm font-medium hover:underline">
            Ver todas
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left p-4 font-medium text-gray-500">Número</th>
                <th className="text-left p-4 font-medium text-gray-500">Cliente</th>
                <th className="text-left p-4 font-medium text-gray-500">Fecha</th>
                <th className="text-right p-4 font-medium text-gray-500">Total</th>
                <th className="text-left p-4 font-medium text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center p-8 text-gray-400">Cargando...</td></tr>
              ) : kpis.recientes.length === 0 ? (
                <tr><td colSpan={5} className="text-center p-8 text-gray-400">No hay proformas aún</td></tr>
              ) : (
                kpis.recientes.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="p-4">
                      <Link href={`/cotizador/${p.id}`} className="font-mono text-[#1E3A5F] hover:underline font-medium">
                        {p.numero}
                      </Link>
                    </td>
                    <td className="p-4 text-gray-700">{p.cliente?.nombre}</td>
                    <td className="p-4 text-gray-500">{p.fecha}</td>
                    <td className="p-4 text-right font-medium">
                      {p.total_cif_usd ? formatUSD(p.total_cif_usd) : p.total_fob_usd ? formatUSD(p.total_fob_usd) : '—'}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoBadge(p.estado)}`}>
                        {p.estado.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 mt-6 mb-10">
        <Link href="/cotizador/nueva"
          className="px-5 py-2.5 rounded-lg font-medium text-sm text-white flex items-center gap-2"
          style={{ background: '#1E3A5F' }}>
          <FileText size={16} />
          Nueva Proforma
        </Link>
        <Link href="/historial"
          className="px-5 py-2.5 rounded-lg font-medium text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-2">
          <TrendingUp size={16} />
          Ver Historial de Precios
        </Link>
      </div>

      {/* ── Panel CEO ── */}
      <div className="border-t border-gray-100 pt-8">
        <h2 className="text-lg font-bold text-[#1E3A5F] mb-4">Panel de la CEO</h2>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="inline-flex p-2 rounded-lg mb-3 bg-emerald-100 text-emerald-700">
              <DollarSign size={20} />
            </div>
            <p className="text-3xl font-bold text-gray-800">
              {stats ? formatUSD(stats.facturacion_total) : '—'}
            </p>
            <p className="text-sm text-gray-500 mt-1">Facturación total (enviadas + facturadas)</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="inline-flex p-2 rounded-lg mb-3 bg-sky-100 text-sky-700">
              <Ship size={20} />
            </div>
            <p className="text-3xl font-bold text-gray-800">
              {stats?.otif.pct != null ? `${(stats.otif.pct * 100).toFixed(0)}%` : '—'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              OTIF {stats ? `(${stats.otif.a_tiempo}/${stats.otif.total_entregados} despachos a tiempo)` : ''}
            </p>
          </div>
        </div>

        {/* Tiempos por etapa */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Clock size={16} className="text-[#D4A017]" /> Tiempo promedio por etapa
          </h3>
          {!stats || stats.tiempos_por_etapa.length === 0 ? (
            <p className="text-sm text-gray-400">Aún no hay suficientes datos de transiciones</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {stats.tiempos_por_etapa.map(t => (
                <div key={t.etapa} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{t.etapa}</p>
                  <p className="text-lg font-bold text-[#1E3A5F]">{fechaLabel(t.promedio_horas)}</p>
                  <p className="text-xs text-gray-400">{t.muestras} muestra{t.muestras !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pipeline */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h3 className="font-bold text-gray-800 mb-3">Pipeline general</h3>
          <div className="flex flex-wrap gap-3">
            <Link href="/solicitudes" className="flex items-center gap-2 bg-yellow-50 border border-yellow-100 rounded-lg px-4 py-2.5 hover:bg-yellow-100">
              <Inbox size={16} className="text-yellow-600" />
              <span className="text-sm font-semibold text-yellow-700">{stats?.pipeline.solicitudes_pendientes ?? 0} solicitudes pendientes</span>
            </Link>
            {Object.entries(stats?.pipeline.proformas || {}).map(([estado, n]) => (
              <div key={estado} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5">
                <FileText size={16} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-600">{n} {estado.replace('_', ' ')}</span>
              </div>
            ))}
            {Object.entries(stats?.pipeline.despachos || {}).map(([estado, n]) => (
              <Link key={estado} href="/despachos" className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 hover:bg-blue-100">
                <Ship size={16} className="text-blue-500" />
                <span className="text-sm font-medium text-blue-700">{n} {estado.replace('_', ' ')}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Condiciones comerciales */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-gray-800 mb-3">Condiciones comerciales</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Márgenes por cliente</p>
              <div className="space-y-1.5">
                {clientes.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{c.nombre} <span className="text-xs text-gray-400">({c.tipo})</span></span>
                    <span className="font-medium text-gray-800">{c.margen_min}% – {c.margen_max}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Parámetros de flete/arancel activos</p>
              <div className="space-y-1.5">
                {parametros.length === 0 ? (
                  <p className="text-sm text-gray-400">Sin parámetros activos</p>
                ) : parametros.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{p.nombre}</span>
                    <span className="font-medium text-gray-800">{formatUSD(p.flete_usd)} · {(p.arancel_pct * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
