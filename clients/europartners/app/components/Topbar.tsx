'use client'

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import NotifBell from './NotifBell'
import ThemeToggle from './ThemeToggle'

type TopbarProps = {
  sidebarVisible: boolean
  onToggleSidebar: () => void
}

export default function Topbar({ sidebarVisible, onToggleSidebar }: TopbarProps) {
  return (
    <header className="h-14 flex-shrink-0 flex items-center justify-between px-6 border-b border-border bg-bg-surface">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={sidebarVisible ? 'Ocultar menú' : 'Mostrar menú'}
        title={sidebarVisible ? 'Ocultar menú' : 'Mostrar menú'}
        // p-3 (no p-2) para que el botón llegue a los ~44px de mínimo táctil
        // en mobile -- antes quedaba en 36px.
        className="p-3 -ml-3 rounded-lg text-text-muted hover:text-text-heading hover:bg-bg-subtle transition-colors"
      >
        {sidebarVisible ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
      </button>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <NotifBell />
      </div>
    </header>
  )
}
