"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  MessageCircle,
  Users,
  BookOpen,
  FileText,
  TrendingUp,
  Wifi,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const principalItems = [
  { href: "/whatsapp", label: "Bot WhatsApp", icon: MessageCircle },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/tickets", label: "Tickets", icon: ClipboardList },
];

const gestionItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

const configItems = [
  { href: "/conocimiento", label: "Conocimiento", icon: BookOpen },
  { href: "/plantillas", label: "Plantillas", icon: FileText },
  { href: "/funnel", label: "Funnel", icon: TrendingUp },
];

function NavSection({ label, items, pathname }: {
  label: string;
  items: { href: string; label: string; icon: React.ElementType }[];
  pathname: string;
}) {
  return (
    <div>
      <p className="px-3 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              pathname === href
                ? "bg-orange-500 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-gray-900 flex flex-col z-50">
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">Fijo</p>
            <p className="text-gray-400 text-xs mt-0.5">para RedLine</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        <NavSection label="Principal" items={principalItems} pathname={pathname} />
        <NavSection label="Gestión" items={gestionItems} pathname={pathname} />
        <NavSection label="Configuración" items={configItems} pathname={pathname} />
      </nav>

      <div className="px-4 py-4 border-t border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
            <Wifi className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white text-sm font-medium">RedLine</p>
            <p className="text-gray-400 text-xs">Administrador</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
