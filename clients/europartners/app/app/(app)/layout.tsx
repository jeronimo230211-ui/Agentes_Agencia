'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'

const SIDEBAR_STORAGE_KEY = 'ep_sidebar_visible'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [loaded, setLoaded] = useState(false)

  // useLayoutEffect (no useEffect) -- corre antes del primer paint, para que
  // en mobile no se llegue a ver ni un frame del drawer + backdrop abiertos
  // antes de cerrarse solo.
  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_STORAGE_KEY)
      if (raw !== null) {
        setSidebarVisible(raw === '1')
      } else if (window.innerWidth < 768) {
        // Primera visita, sin preferencia guardada: en mobile el drawer
        // arranca cerrado (BUG-003) -- si no, el primer load siempre tapa
        // la pantalla con el menú en vez de mostrar el contenido.
        setSidebarVisible(false)
      }
    } catch {}
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarVisible ? '1' : '0')
    } catch {}
  }, [sidebarVisible, loaded])

  return (
    <div className="flex min-h-screen">
      {sidebarVisible && <Sidebar onClose={() => setSidebarVisible(false)} />}
      <div className="flex-1 flex flex-col overflow-auto min-w-0">
        <Topbar
          sidebarVisible={sidebarVisible}
          onToggleSidebar={() => setSidebarVisible(v => !v)}
        />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
