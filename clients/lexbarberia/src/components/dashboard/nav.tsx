"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { CalendarDays, Scissors, Settings, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", label: "Hoy", icon: CalendarDays },
  { href: "/dashboard/servicios", label: "Servicios", icon: Scissors },
  { href: "/dashboard/ajustes", label: "Ajustes", icon: Settings },
]

export function DashboardNav() {
  const pathname = usePathname()
  const router = useRouter()
  const isActive = (href: string) => (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href))

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  return (
    <>
      {/* Sidebar de escritorio */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-56 flex-col border-r border-border bg-surface z-40">
        <div className="px-5 py-6">
          <Image src="/logo.png" alt="Lex Barbería" width={160} height={84} className="w-full h-auto" priority />
          <p className="text-xs text-muted-foreground mt-1">Panel de Alex</p>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(href) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 mx-3 mb-4 rounded-md text-sm font-medium text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </aside>

      {/* Barra inferior en celular */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface">
        <div className="flex">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[58px] text-[10px] font-medium transition-colors",
                isActive(href) ? "text-gold-bright" : "text-muted-foreground"
              )}
            >
              <Icon size={20} strokeWidth={isActive(href) ? 2.5 : 1.8} />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  )
}
