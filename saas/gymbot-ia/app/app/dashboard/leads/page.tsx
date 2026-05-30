"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import type { Lead } from "@/lib/supabase"

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")

  useEffect(() => {
    async function fetchLeads() {
      try {
        const res = await fetch("/api/gyms?resource=leads")
        if (res.ok) {
          const json = await res.json()
          setLeads(json.leads || [])
        }
      } catch {
        setLeads([])
      } finally {
        setLoading(false)
      }
    }
    fetchLeads()
  }, [])

  const filtered = leads.filter(
    (l) =>
      !filter ||
      l.name?.toLowerCase().includes(filter.toLowerCase()) ||
      l.phone.includes(filter) ||
      l.interest?.toLowerCase().includes(filter.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#A8FF3E] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#F2F0EB]">Leads</h1>
          <p className="text-sm text-[#8B8F8D]">
            {leads.length} interesados capturados por el bot
          </p>
        </div>
      </div>

      {/* Filter */}
      <input
        type="text"
        placeholder="Buscar por nombre, teléfono o interés..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="flex h-10 w-full max-w-sm rounded-lg border border-[#2A2D2C] bg-[#1A1D1C] px-3 py-2 text-sm text-[#F2F0EB] placeholder:text-[#8B8F8D] focus:outline-none focus:ring-2 focus:ring-[#A8FF3E]"
      />

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[#2A2D2C] bg-[#141716] py-16 text-center">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-lg font-bold text-[#F2F0EB]">
            {leads.length === 0 ? "Aún no hay leads" : "Sin resultados"}
          </p>
          <p className="text-sm text-[#8B8F8D] mt-1">
            {leads.length === 0
              ? "El bot capturará leads automáticamente cuando alguien muestre interés en WhatsApp."
              : "Prueba con otro término de búsqueda."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#2A2D2C]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2A2D2C] bg-[#141716]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#8B8F8D] uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#8B8F8D] uppercase tracking-wider">
                  Teléfono
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#8B8F8D] uppercase tracking-wider hidden sm:table-cell">
                  Interés
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#8B8F8D] uppercase tracking-wider hidden md:table-cell">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#8B8F8D] uppercase tracking-wider">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2D2C] bg-[#0D0F0E]">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-[#141716] transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-[#F2F0EB]">
                      {lead.name || "Sin nombre"}
                    </p>
                    {lead.email && (
                      <p className="text-xs text-[#8B8F8D]">{lead.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#F2F0EB]">{lead.phone}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {lead.interest ? (
                      <Badge variant="default">{lead.interest}</Badge>
                    ) : (
                      <Badge variant="secondary">General</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#8B8F8D] hidden md:table-cell">
                    {new Date(lead.created_at).toLocaleDateString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-[#2A2D2C] px-3 py-1.5 text-xs font-semibold text-[#F2F0EB] hover:border-[#A8FF3E] hover:text-[#A8FF3E] transition-colors"
                    >
                      💬 WhatsApp
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
