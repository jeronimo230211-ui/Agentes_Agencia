'use client'

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import NotifBell from './NotifBell'

type TopbarProps = {
  sidebarVisible: boolean
  onToggleSidebar: () => void
}

export default function Topbar({ sidebarVisible, onToggleSidebar }: TopbarProps) {
  return (
    <header className="h-14 flex-shrink-0 flex items-center justify-between px-6 border-b border-gray-100 bg-white">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={sidebarVisible ? 'Ocultar menú' : 'Mostrar menú'}
        title={sidebarVisible ? 'Ocultar menú' : 'Mostrar menú'}
        className="p-2 -ml-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
      >
        {sidebarVisible ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
      </button>
      <NotifBell />
    </header>
  )
}
