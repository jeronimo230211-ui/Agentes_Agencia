'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, BookOpen, DollarSign,
  CheckSquare, History, Receipt, LogOut, ClipboardList, Inbox, Ship, BarChart3,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Usuario } from '@/types/europartners'

const navItems = [
  { href: '/dashboard',  label: 'Dashboard',        icon: LayoutDashboard, roles: ['operaciones', 'admin', 'analista', 'diseñadora'] as string[] },
  { href: '/solicitudes', label: 'Solicitudes',     icon: Inbox,           roles: ['operaciones', 'admin', 'analista', 'diseñadora'] as string[] },
  { href: '/proformas',  label: 'Proformas',         icon: ClipboardList,   roles: ['operaciones', 'admin', 'analista', 'diseñadora'] as string[] },
  { href: '/despachos',  label: 'Despachos',         icon: Ship,            roles: ['operaciones', 'admin', 'analista', 'diseñadora'] as string[] },
  { href: '/catalogo',   label: 'Catálogo',          icon: BookOpen,        roles: ['operaciones', 'admin', 'analista', 'diseñadora'] as string[] },
  { href: '/precios',    label: 'Motor de Precios',  icon: DollarSign,      roles: ['operaciones', 'admin', 'analista', 'diseñadora'] as string[] },
  { href: '/aprobacion', label: 'Aprobaciones',      icon: CheckSquare,     roles: ['admin'] as string[] },
  { href: '/historial',  label: 'Historial Precios', icon: History,         roles: ['operaciones', 'admin', 'analista', 'diseñadora'] as string[] },
  { href: '/reportes',   label: 'Reportes',          icon: BarChart3,       roles: ['admin', 'analista', 'diseñadora'] as string[] },
  { href: '/facturador', label: 'Facturador',        icon: Receipt,         roles: ['admin'] as string[] },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)

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

  async function cerrarSesion() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navVisibles = navItems.filter(item =>
    !usuario || item.roles.includes(usuario.rol)
  )

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col" style={{ background: '#1E3A5F', minHeight: '100vh' }}>
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: '#D4A017', color: '#1E3A5F' }}>
            EP
          </div>
          <span className="text-white font-bold text-base tracking-wide">EUROPARTNERS</span>
        </div>
        <p className="text-white/50 text-xs pl-10">Sistema de Operaciones</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navVisibles.map(({ href, label, icon: Icon }) => {
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
            </Link>
          )
        })}
      </nav>

      {/* Usuario y logout */}
      <div className="px-4 py-4 border-t border-white/10">
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
