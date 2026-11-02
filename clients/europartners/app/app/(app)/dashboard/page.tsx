'use client'
import { useState, useEffect } from 'react'
import { FileText, CheckCircle, Send, Clock, TrendingUp, AlertCircle, DollarSign, Ship, Inbox } from 'lucide-react'
import Link from 'next/link'
import { formatUSD } from '@/lib/precio'
import { supabase } from '@/lib/supabase'
import MisPendientesPanel from '@/components/MisPendientesPanel'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import StatCard from '@/components/ui/StatCard'
import DataTable from '@/components/ui/DataTable'
import type { Proforma, Usuario } from '@/types/europartners'

interface KPIs {
  recientes: Proforma[]
}

interface MargenStats { min: number; max: number; avg: number; n: number }

interface StatsCEO {
  facturacion_total: number
  otif: { total_entregados: number; a_tiempo: number; pct: number | null }
  tiempos_por_etapa: { etapa: string; promedio_horas: number; muestras: number }[]
  pipeline: {
    solicitudes_pendientes: number
    proformas: Record<string, number>
    despachos: Record<string, number>
  }
  margenes_catalogo: { mayorista: MargenStats | null; detallista: MargenStats | null }
}

interface Cliente { id: string; nombre: string; tipo: string }
interface ParametroPrecio { id: string; nombre: string; flete_usd: number; arancel_pct: number; cbm_total_contenedor: number; valido_desde: string }

function fechaLabel(horas: number) {
  if (horas < 24) return `${horas.toFixed(1)} h`
  return `${(horas / 24).toFixed(1)} días`
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs>({ recientes: [] })
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
      // Solo para la tabla "Proformas recientes" (las últimas 8) -- los
      // conteos de los tiles de arriba NO salen de acá, ver BUG-008.
      const res = await fetch('/api/proformas?limit=20')
      const { data } = await res.json()
      if (!data) return
      setKpis({ recientes: data.slice(0, 8) })
      setLoading(false)
    }
    cargar()

    fetch('/api/dashboard/stats').then(r => r.json()).then(setStats)
    fetch('/api/clientes').then(r => r.json()).then(({ data }) => setClientes(data || []))
    fetch('/api/parametros-precio').then(r => r.json()).then(({ data }) => setParametros(data || []))
  }, [])

  // BUG-008: los 4 tiles de arriba y el panel "Pipeline general" más abajo
  // mostraban números distintos para el mismo estado (ej. "Enviadas: 0" arriba
  // vs "Enviadas: 95" en Pipeline general). Causa raíz: estos tiles se
  // calculaban contando solo las 20 proformas más recientes (/api/proformas
  // ?limit=20, la misma lista que alimenta "Proformas recientes" abajo), no el
  // total real -- si ninguna de las últimas 20 estaba en un estado dado, el
  // tile mostraba 0 aunque sí hubiera muchas en ese estado históricamente.
  // "Pipeline general" ya usaba /api/dashboard/stats, que cuenta sobre TODA la
  // tabla (ver route.ts: "Conteos por estado (sobre toda la tabla...)"). Ahora
  // ambos bloques leen del mismo stats.pipeline.proformas -- un solo número real.
  const kpiCards = [
    { label: 'Borradores', value: stats?.pipeline.proformas.borrador ?? 0, icon: FileText, color: 'bg-bg-subtle text-text-muted', href: '/proformas?estado=borrador' },
    { label: 'En revisión', value: stats?.pipeline.proformas.en_revision ?? 0, icon: Clock, color: 'bg-warning-bg text-warning', href: '/proformas?estado=en_revision' },
    { label: 'Aprobadas', value: stats?.pipeline.proformas.aprobada ?? 0, icon: CheckCircle, color: 'bg-success-bg text-success', href: '/proformas?estado=aprobada' },
    { label: 'Enviadas', value: stats?.pipeline.proformas.enviada ?? 0, icon: Send, color: 'bg-info-bg text-info', href: '/proformas?estado=enviada' },
  ]
  const kpiCardsLoading = loading || !stats

  // Colapso de 8 colores de estado ad-hoc a los 4 tokens semánticos del
  // sistema de Marta (success/warning/danger/info) + neutral para
  // borrador -- ver Badge.tsx. "facturada" (antes morado) y "anulada"
  // (antes slate) se mapean a info/danger respectivamente, decisión
  // aprobada por Jero (Lote 2, rebrand oct-2026).
  const ESTADO_VARIANT: Record<string, BadgeVariant> = {
    borrador: 'neutral',
    en_revision: 'warning',
    aprobada: 'success',
    rechazada: 'danger',
    enviada: 'info',
    facturada: 'info',
    anulada: 'danger',
  }
  const estadoVariant = (estado: string): BadgeVariant => ESTADO_VARIANT[estado] ?? 'neutral'

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-heading-1 text-text-heading">Dashboard</h1>
        <p className="text-text-muted text-sm mt-1">Resumen de operaciones</p>
      </div>

      {/* Mis Pendientes — lo primero que ve Marta al entrar */}
      {usuario?.rol === 'admin' && <MisPendientesPanel />}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {kpiCards.map(({ label, value, icon, color, href }) => (
          <StatCard key={label} label={label} value={value} icon={icon} iconClassName={color} href={href} loading={kpiCardsLoading} />
        ))}
      </div>

      {/* Alertas genéricas — para no-admin; para admin ya lo cubre Mis Pendientes arriba */}
      {usuario?.rol !== 'admin' && (stats?.pipeline.proformas.en_revision ?? 0) > 0 && (
        <div className="bg-warning-bg border border-warning rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertCircle size={20} className="text-warning flex-shrink-0" />
          <div>
            <p className="font-medium text-warning">
              {stats!.pipeline.proformas.en_revision} proforma{stats!.pipeline.proformas.en_revision > 1 ? 's' : ''} esperando aprobación
            </p>
            <Link href="/aprobacion" className="text-warning underline text-sm">
              Ir a Aprobaciones →
            </Link>
          </div>
        </div>
      )}

      {/* Tabla recientes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-text flex items-center gap-2">
            <TrendingUp size={18} className="text-text-heading" />
            Proformas recientes
          </h2>
          <Link href="/cotizador" className="text-action-primary text-sm font-medium hover:underline">
            Ver todas
          </Link>
        </div>
        <DataTable
          loading={loading}
          emptyMessage="No hay proformas aún"
          rows={kpis.recientes}
          rowKey={p => p.id}
          columns={[
            {
              key: 'numero',
              header: 'Número',
              render: p => (
                <Link href={`/cotizador/${p.id}`} className="font-mono text-action-primary hover:underline font-medium">
                  {p.numero}
                </Link>
              ),
            },
            { key: 'cliente', header: 'Cliente', render: p => p.cliente?.nombre },
            { key: 'fecha', header: 'Fecha', render: p => p.fecha },
            {
              key: 'total',
              header: 'Total',
              align: 'right',
              render: p => p.total_cif_usd ? formatUSD(p.total_cif_usd) : p.total_fob_usd ? formatUSD(p.total_fob_usd) : '—',
            },
            {
              key: 'estado',
              header: 'Estado',
              render: p => <Badge variant={estadoVariant(p.estado)}>{p.estado.replace('_', ' ')}</Badge>,
            },
          ]}
        />
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 mt-6 mb-10">
        <Link href="/proformas"
          className="px-5 py-2.5 rounded-lg font-medium text-sm bg-action-primary text-on-action-primary hover:bg-action-primary-hover flex items-center gap-2">
          <FileText size={16} />
          Nueva Proforma
        </Link>
        <Link href="/historial"
          className="px-5 py-2.5 rounded-lg font-medium text-sm border border-border text-text-muted hover:bg-bg-subtle flex items-center gap-2">
          <TrendingUp size={16} />
          Ver Historial de Precios
        </Link>
      </div>

      {/* ── Panel CEO ── */}
      <div className="border-t border-border pt-8">
        <h2 className="text-heading-3 text-text-heading mb-4">Panel de la CEO</h2>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <StatCard
            label="Facturación total (enviadas + facturadas)"
            value={stats ? formatUSD(stats.facturacion_total) : '—'}
            icon={DollarSign}
            iconClassName="bg-success-bg text-success"
          />
          <StatCard
            label={`OTIF ${stats ? `(${stats.otif.a_tiempo}/${stats.otif.total_entregados} despachos a tiempo)` : ''}`}
            value={stats?.otif.pct != null ? `${(stats.otif.pct * 100).toFixed(0)}%` : '—'}
            icon={Ship}
            iconClassName="bg-info-bg text-info"
          />
        </div>

        {/* Tiempos por etapa */}
        <div className="bg-bg-surface rounded-xl shadow-sm border border-border p-5 mb-6">
          <h3 className="font-bold text-text mb-3 flex items-center gap-2">
            <Clock size={16} className="text-text-heading" /> Tiempo promedio por etapa
          </h3>
          {!stats || stats.tiempos_por_etapa.length === 0 ? (
            <p className="text-sm text-text-subtle">Aún no hay suficientes datos de transiciones</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {stats.tiempos_por_etapa.map(t => (
                <div key={t.etapa} className="bg-bg-subtle rounded-lg p-3">
                  <p className="text-xs text-text-muted">{t.etapa}</p>
                  <p className="text-lg font-bold text-text-heading">{fechaLabel(t.promedio_horas)}</p>
                  <p className="text-xs text-text-subtle">{t.muestras} muestra{t.muestras !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pipeline */}
        <div className="bg-bg-surface rounded-xl shadow-sm border border-border p-5 mb-6">
          <h3 className="font-bold text-text mb-3">Pipeline general</h3>
          <div className="flex flex-wrap gap-3">
            <Link href="/solicitudes" className="flex items-center gap-2 bg-warning-bg border border-warning rounded-lg px-4 py-2.5 hover:bg-warning-bg">
              <Inbox size={16} className="text-warning" />
              <span className="text-sm font-semibold text-warning">{stats?.pipeline.solicitudes_pendientes ?? 0} solicitudes pendientes</span>
            </Link>
            {Object.entries(stats?.pipeline.proformas || {}).map(([estado, n]) => (
              <div key={estado} className="flex items-center gap-2 bg-bg-subtle border border-border rounded-lg px-4 py-2.5">
                <FileText size={16} className="text-text-subtle" />
                <span className="text-sm font-medium text-text-muted">{n} {estado.replace('_', ' ')}</span>
              </div>
            ))}
            {Object.entries(stats?.pipeline.despachos || {}).map(([estado, n]) => (
              <Link key={estado} href="/despachos" className="flex items-center gap-2 bg-info-bg border border-info rounded-lg px-4 py-2.5 hover:bg-info-bg">
                <Ship size={16} className="text-info" />
                <span className="text-sm font-medium text-info">{n} {estado.replace('_', ' ')}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Condiciones comerciales */}
        <div className="bg-bg-surface rounded-xl shadow-sm border border-border p-5">
          <h3 className="font-bold text-text mb-3">Condiciones comerciales</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold text-text-subtle uppercase mb-2">Margen real (calculado del catálogo)</p>
              <div className="space-y-1.5 mb-3">
                {(['mayorista', 'detallista'] as const).map(tipo => {
                  const m = stats?.margenes_catalogo[tipo]
                  return (
                    <div key={tipo} className="flex items-center justify-between text-sm">
                      <span className="text-text-muted capitalize">{tipo}</span>
                      <span className="font-medium text-text">
                        {m ? `${m.min.toFixed(1)}% – ${m.max.toFixed(1)}% (prom. ${m.avg.toFixed(1)}%, ${m.n} productos)` : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs font-semibold text-text-subtle uppercase mb-2">Clientes por tipo</p>
              <div className="space-y-1.5">
                {clientes.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">{c.nombre}</span>
                    <span className="text-xs text-text-subtle capitalize">{c.tipo}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-subtle uppercase mb-2">Parámetros de flete/arancel activos</p>
              <div className="space-y-1.5">
                {parametros.length === 0 ? (
                  <p className="text-sm text-text-subtle">Sin parámetros activos</p>
                ) : parametros.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">{p.nombre}</span>
                    <span className="font-medium text-text">{formatUSD(p.flete_usd)} · {(p.arancel_pct * 100).toFixed(1)}%</span>
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
