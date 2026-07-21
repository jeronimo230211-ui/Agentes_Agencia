'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Clock, CheckSquare, DollarSign, Ship } from 'lucide-react'
import { formatUSD } from '@/lib/precio'

interface ItemEnRevision { id: string; numero: string; cliente: string | null; total: number | null; horas: number | null }
interface ItemPago { id: string; numero: string; cliente: string | null; total: number | null; estado_pago: string; horas: number | null }
interface ItemDespacho { id: string; numero_proforma: string | null; cliente: string | null; naviera: string | null; estado: string; horas: number | null }

interface MisPendientes {
  en_revision: ItemEnRevision[]
  pago_pendiente: ItemPago[]
  despachos_pendientes: ItemDespacho[]
}

function tiempoLabel(horas: number | null) {
  if (horas == null) return '—'
  if (horas < 1) return '< 1 h'
  if (horas < 24) return `${Math.round(horas)} h`
  return `${(horas / 24).toFixed(1)} días`
}

function urgencia(horas: number | null) {
  if (horas == null) return 'text-gray-400'
  if (horas >= 72) return 'text-red-600 font-semibold'
  if (horas >= 24) return 'text-amber-600 font-medium'
  return 'text-gray-500'
}

function Seccion({ titulo, icon: Icon, count, href, children }: {
  titulo: string; icon: typeof Clock; count: number; href: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-[#1E3A5F]" />
          <h3 className="text-sm font-semibold text-[#1E3A5F]">{titulo}</h3>
          {count > 0 && (
            <span className="bg-[#D4A017] text-[#1E3A5F] text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {count}
            </span>
          )}
        </div>
        <Link href={href} className="text-xs text-gray-400 hover:text-[#1E3A5F] underline">Ver todo</Link>
      </div>
      {count === 0 ? (
        <p className="text-xs text-gray-300 italic py-2">Sin pendientes</p>
      ) : (
        <div className="space-y-1.5">{children}</div>
      )}
    </div>
  )
}

export default function MisPendientesPanel() {
  const [data, setData] = useState<MisPendientes | null>(null)

  useEffect(() => {
    fetch('/api/mis-pendientes').then(r => r.ok ? r.json() : null).then(setData).catch(() => {})
  }, [])

  if (!data) return null

  const total = data.en_revision.length + data.pago_pendiente.length + data.despachos_pendientes.length
  if (total === 0) return null

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={18} className="text-[#D4A017]" />
        <h2 className="text-lg font-bold text-[#1E3A5F]">Mis Pendientes</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Seccion titulo="Por aprobar" icon={CheckSquare} count={data.en_revision.length} href="/aprobacion">
          {data.en_revision.slice(0, 5).map(p => (
            <Link key={p.id} href="/aprobacion" className="flex items-center justify-between text-xs py-1.5 hover:bg-gray-50 rounded px-1 -mx-1">
              <span className="text-gray-700 truncate">{p.numero} · {p.cliente || '—'}</span>
              <span className={`flex-shrink-0 ml-2 ${urgencia(p.horas)}`}>{tiempoLabel(p.horas)}</span>
            </Link>
          ))}
        </Seccion>

        <Seccion titulo="Pagos por confirmar" icon={DollarSign} count={data.pago_pendiente.length} href="/proformas">
          {data.pago_pendiente.slice(0, 5).map(p => (
            <div key={p.id} className="flex items-center justify-between text-xs py-1.5">
              <span className="text-gray-700 truncate">{p.numero} · {p.cliente || '—'}{p.total != null ? ` · ${formatUSD(p.total)}` : ''}</span>
              <span className={`flex-shrink-0 ml-2 ${urgencia(p.horas)}`}>{tiempoLabel(p.horas)}</span>
            </div>
          ))}
        </Seccion>

        <Seccion titulo="Despachos en curso" icon={Ship} count={data.despachos_pendientes.length} href="/despachos">
          {data.despachos_pendientes.slice(0, 5).map(d => (
            <Link key={d.id} href="/despachos" className="flex items-center justify-between text-xs py-1.5 hover:bg-gray-50 rounded px-1 -mx-1">
              <span className="text-gray-700 truncate">{d.numero_proforma || '—'} · {d.cliente || '—'}</span>
              <span className={`flex-shrink-0 ml-2 ${urgencia(d.horas)}`}>{tiempoLabel(d.horas)}</span>
            </Link>
          ))}
        </Seccion>
      </div>
    </div>
  )
}
