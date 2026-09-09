'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'

const SIDEBAR_STORAGE_KEY = 'ep_sidebar_visible'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_STORAGE_KEY)
      if (raw !== null) setSidebarVisible(raw === '1')
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
      {sidebarVisible && <Sidebar />}
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
