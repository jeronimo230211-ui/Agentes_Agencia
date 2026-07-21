'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import type { Notificacion } from '@/types/europartners'

function tiempoRelativo(iso: string) {
  const horas = (Date.now() - new Date(iso).getTime()) / 3_600_000
  if (horas < 1) return 'hace un momento'
  if (horas < 24) return `hace ${Math.round(horas)} h`
  return `hace ${Math.round(horas / 24)} d`
}

export default function NotifBell() {
  const [notifs, setNotifs] = useState<Notificacion[]>([])
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  async function cargar() {
    const res = await fetch('/api/notificaciones')
    if (!res.ok) return
    const { data } = await res.json()
    setNotifs(data || [])
  }

  useEffect(() => {
    cargar()
    const interval = setInterval(cargar, 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', onClickFuera)
    return () => document.removeEventListener('mousedown', onClickFuera)
  }, [])

  async function marcarLeida(id: string) {
    await fetch('/api/notificaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
  }

  const noLeidas = notifs.filter(n => !n.leida).length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAbierto(v => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notificaciones"
      >
        <Bell size={19} className="text-gray-600" />
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50 max-h-96 overflow-y-auto">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-[#1E3A5F]">Notificaciones</p>
          </div>
          {notifs.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">Sin notificaciones</p>
          ) : (
            notifs.map(n => (
              <Link
                key={n.id}
                href={n.proforma_id ? '/proformas' : '#'}
                onClick={() => !n.leida && marcarLeida(n.id)}
                className={`block px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${!n.leida ? 'bg-blue-50/40' : ''}`}
              >
                <p className="text-xs text-gray-700">{n.mensaje}</p>
                <p className="text-[10px] text-gray-400 mt-1">{tiempoRelativo(n.created_at)}</p>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
