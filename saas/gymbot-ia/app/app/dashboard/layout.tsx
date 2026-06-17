import Link from "next/link"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0D0F0E]">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-56 border-r border-[#2A2D2C] bg-[#141716]">
        <div className="flex h-16 items-center gap-2 border-b border-[#2A2D2C] px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-black text-[#F2F0EB]">GymBot</span>
            <span className="rounded-md bg-[#A8FF3E] px-1.5 py-0.5 text-xs font-bold text-[#0D0F0E]">
              IA
            </span>
          </Link>
        </div>
        <nav className="p-3 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#F2F0EB] hover:bg-[#1A1D1C] hover:text-[#A8FF3E] transition-colors"
          >
            <span>📊</span>
            Resumen
          </Link>
          <Link
            href="/dashboard/pipeline"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#F2F0EB] hover:bg-[#1A1D1C] hover:text-[#A8FF3E] transition-colors"
          >
            <span>🎯</span>
            Pipeline
          </Link>
          <Link
            href="/dashboard/leads"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#F2F0EB] hover:bg-[#1A1D1C] hover:text-[#A8FF3E] transition-colors"
          >
            <span>👥</span>
            Leads
          </Link>
          <Link
            href="/dashboard/config"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#F2F0EB] hover:bg-[#1A1D1C] hover:text-[#A8FF3E] transition-colors"
          >
            <span>⚙️</span>
            Configuración
          </Link>
        </nav>
        <div className="absolute bottom-4 left-0 right-0 px-4">
          <div className="rounded-lg border border-[#A8FF3E]/20 bg-[#A8FF3E]/5 p-3">
            <p className="text-xs font-semibold text-[#A8FF3E]">Plan Esencial</p>
            <p className="text-xs text-[#8B8F8D] mt-0.5">Activo · $79/mes</p>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="ml-56">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#2A2D2C] bg-[#0D0F0E]/80 px-6 backdrop-blur">
          <div>
            <p className="text-xs text-[#8B8F8D]">Panel de control</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#A8FF3E] animate-pulse" />
            <span className="text-sm text-[#8B8F8D]">Bot activo</span>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
