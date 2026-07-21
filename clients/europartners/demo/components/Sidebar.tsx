"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, DollarSign, FileText, Receipt, LayoutDashboard } from "lucide-react";

const navItems = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/catalogo", label: "Catálogo", icon: BookOpen },
  { href: "/precios", label: "Motor de Precios", icon: DollarSign },
  { href: "/cotizador", label: "Cotizador", icon: FileText },
  { href: "/facturador", label: "Facturador", icon: Receipt },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col" style={{ background: "#1E3A5F", minHeight: "100vh" }}>
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: "#D4A017", color: "#1E3A5F" }}>
            EP
          </div>
          <span className="text-white font-bold text-base tracking-wide">EUROPARTNERS</span>
        </div>
        <p className="text-white/50 text-xs pl-10">Sistema de Operaciones</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "text-white"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
              style={active ? { background: "#D4A017", color: "#1E3A5F" } : {}}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/10">
        <p className="text-white/30 text-xs">Demo por Nexora IA</p>
        <p className="text-white/20 text-xs">v1.0 — Junio 2026</p>
      </div>
    </aside>
  );
}
