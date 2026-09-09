'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, BookOpen, Wallet, Package,
  CheckSquare, History, Receipt, LogOut, ClipboardList, Inbox, Ship, BarChart3, Container,
  ChevronDown,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Usuario } from '@/types/europartners'

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  roles: string[]
  badge?: string
}

type NavCategory = {
  key: string
  label: string
  icon: typeof LayoutDashboard
  items: NavItem[]
}

const dashboardItem: NavItem = {
  href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['operaciones', 'admin', 'analista', 'diseñadora'],
}

const navCategories: NavCategory[] = [
  {
    key: 'pedidos',
    label: 'Pedidos',
    icon: Package,
    items: [
      { href: '/solicitudes', label: 'Solicitudes', icon: Inbox, roles: ['operaciones', 'admin', 'analista', 'diseñadora'] },
      { href: '/proformas', label: 'Proformas', icon: ClipboardList, roles: ['operaciones', 'admin', 'analista', 'diseñadora'] },
      { href: '/proformas-china', label: 'Proformas China', icon: Container, roles: ['operaciones', 'admin'] },
      { href: '/aprobacion', label: 'Aprobaciones', icon: CheckSquare, roles: ['admin'] },
      { href: '/facturador', label: 'Facturador', icon: Receipt, roles: ['admin'] },
      { href: '/despachos', label: 'Despachos', icon: Ship, roles: ['operaciones', 'admin', 'analista', 'diseñadora'] },
    ],
  },
  {
    key: 'catalogo',
    label: 'Catálogo',
    icon: BookOpen,
    items: [
      { href: '/catalogo', label: 'Catálogo', icon: BookOpen, roles: ['operaciones', 'admin', 'analista', 'diseñadora'] },
      { href: '/historial', label: 'Historial Precios', icon: History, roles: ['operaciones', 'admin', 'analista', 'diseñadora'] },
    ],
  },
  {
    key: 'finanzas',
    label: 'Finanzas',
    icon: Wallet,
    items: [
      // Finanzas: info sensible (deuda, ganancia) — mismo rango de rol que
      // /reportes a nivel de API (admin + analista, ver /api/reportes/tiempos-por-usuario).
      { href: '/finanzas', label: 'Finanzas', icon: Wallet, roles: ['admin', 'analista'], badge: 'nuevo' },
      { href: '/reportes', label: 'Reportes', icon: BarChart3, roles: ['admin', 'analista', 'diseñadora'] },
    ],
  },
]

const EXPANDED_STORAGE_KEY = 'ep_sidebar_expanded_categories'

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    pedidos: true, catalogo: true, finanzas: true,
  })
  const [expandedLoaded, setExpandedLoaded] = useState(false)

  useEffect(() => {
    async function cargar() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (data) setUsuario(data as Usuario)
    }
    cargar()
  }, [pathname])

  // Cargar preferencia de categorías expandidas/colapsadas desde localStorage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXPANDED_STORAGE_KEY)
      if (raw) setExpanded(prev => ({ ...prev, ...JSON.parse(raw) }))
    } catch {}
    setExpandedLoaded(true)
  }, [])

  // Persistir cada cambio de estado de expansión.
  useEffect(() => {
    if (!expandedLoaded) return
    try {
      localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(expanded))
    } catch {}
  }, [expanded, expandedLoaded])

  // Asegurar que la categoría de la ruta activa siempre quede expandida.
  useEffect(() => {
    const activeCategory = navCategories.find(cat =>
      cat.items.some(item => pathname.startsWith(item.href))
    )
    if (activeCategory) {
      setExpanded(prev => prev[activeCategory.key] ? prev : { ...prev, [activeCategory.key]: true })
    }
  }, [pathname])

  async function cerrarSesion() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function toggleCategory(key: string) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const dashboardVisible = !usuario || dashboardItem.roles.includes(usuario.rol)

  function renderItem({ href, label, icon: Icon, badge }: NavItem) {
    const active = pathname.startsWith(href)
    return (
      <Link
        key={href}
        href={href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          active ? 'text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
        style={active ? { background: '#D4A017', color: '#1E3A5F' } : {}}
      >
        <Icon size={18} />
        <span className="flex-1">{label}</span>
        {badge && !active && (
          <span
            className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
            style={{ background: '#D4A017', color: '#1E3A5F' }}
          >
            {badge}
          </span>
        )}
      </Link>
    )
  }

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col sticky top-0" style={{ background: '#1E3A5F', height: '100vh' }}>
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10 flex-none">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: '#D4A017', color: '#1E3A5F' }}>
            EP
          </div>
          <span className="text-white font-bold text-base tracking-wide">EUROPARTNERS</span>
        </div>
        <p className="text-white/50 text-xs pl-10">Sistema de Operaciones</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1">
        {dashboardVisible && renderItem(dashboardItem)}

        {navCategories.map(cat => {
          const visibleItems = cat.items.filter(item => !usuario || item.roles.includes(usuario.rol))
          if (visibleItems.length === 0) return null

          const isExpanded = !!expanded[cat.key]
          const CategoryIcon = cat.icon

          return (
            <div key={cat.key} className="pt-1">
              <button
                type="button"
                onClick={() => toggleCategory(cat.key)}
                aria-expanded={isExpanded}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide text-white/50 hover:text-white hover:bg-white/10 transition-all"
              >
                <CategoryIcon size={16} />
                <span className="flex-1 text-left">{cat.label}</span>
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
              >
                <div className="space-y-1 pt-1">
                  {visibleItems.map(renderItem)}
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      {/* Usuario y logout */}
      <div className="px-4 py-4 border-t border-white/10 flex-none">
        {usuario && (
          <div className="mb-3">
            <p className="text-white text-sm font-medium">{usuario.nombre}</p>
            <p className="text-white/40 text-xs capitalize">{usuario.rol}</p>
          </div>
        )}
        <button
          onClick={cerrarSesion}
          className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors w-full"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
        <p className="text-white/20 text-xs mt-3">Nexora IA · v1.0</p>
      </div>
    </aside>
  )
}
