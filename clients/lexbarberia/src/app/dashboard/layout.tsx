import { DashboardNav } from "@/components/dashboard/nav"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <DashboardNav />
      <main className="md:ml-56 pb-24 md:pb-8 min-h-screen">
        <div className="mx-auto max-w-4xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  )
}
