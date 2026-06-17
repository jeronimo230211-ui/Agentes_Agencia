"use client"

import { useEffect, useState, useCallback } from "react"
import { Badge } from "@/components/ui/badge"

type LeadCard = {
  id: string
  name: string | null
  phone: string
  interest: string | null
  status: string
  lead_value: number | null
  stage_id: string
  rotten_days: number
  created_at: string
  last_activity_at: string | null
  persons?: { name: string | null; contact_numbers: { value: string; label: string }[] } | null
}

type Stage = {
  id: string
  name: string
  code: string
  probability: number
  sort_order: number
  leads: LeadCard[]
  total: number
}

type Pipeline = {
  id: string
  name: string
  rotten_days: number
}

type PipelineData = {
  pipeline: Pipeline | null
  stages: Stage[]
}

const STAGE_COLORS: Record<string, string> = {
  prospecto:  "border-[#3B82F6]/40 bg-[#3B82F6]/5",
  contactado: "border-[#8B5CF6]/40 bg-[#8B5CF6]/5",
  trial:      "border-[#F59E0B]/40 bg-[#F59E0B]/5",
  inscrito:   "border-[#A8FF3E]/40 bg-[#A8FF3E]/5",
  perdido:    "border-[#EF4444]/40 bg-[#EF4444]/5",
}

const STAGE_DOTS: Record<string, string> = {
  prospecto:  "bg-[#3B82F6]",
  contactado: "bg-[#8B5CF6]",
  trial:      "bg-[#F59E0B]",
  inscrito:   "bg-[#A8FF3E]",
  perdido:    "bg-[#EF4444]",
}

export default function PipelinePage() {
  const [data, setData] = useState<PipelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [moving, setMoving] = useState<string | null>(null)

  const fetchPipeline = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline")
      if (res.ok) setData(await res.json())
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPipeline() }, [fetchPipeline])

  async function moveToStage(leadId: string, stageId: string) {
    setMoving(leadId)
    await fetch("/api/pipeline", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, stageId }),
    })
    await fetchPipeline()
    setMoving(null)
  }

  async function markLost(leadId: string) {
    setMoving(leadId)
    await fetch("/api/pipeline", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, status: "lost" }),
    })
    await fetchPipeline()
    setMoving(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#A8FF3E] border-t-transparent" />
      </div>
    )
  }

  if (!data?.pipeline) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-4xl mb-4">🔧</p>
        <h2 className="text-xl font-bold text-[#F2F0EB] mb-2">Pipeline no configurado</h2>
        <p className="text-[#8B8F8D]">
          Ejecuta la migración SQL en Supabase para activar el pipeline CRM.
        </p>
      </div>
    )
  }

  const totalLeads = data.stages.reduce((acc, s) => acc + s.total, 0)
  const stagesForMove = data.stages.filter((s) => s.code !== "perdido")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#F2F0EB]">Pipeline</h1>
          <p className="text-sm text-[#8B8F8D]">
            {data.pipeline.name} · {totalLeads} leads activos · Rotten: {data.pipeline.rotten_days} días
          </p>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {data.stages.map((stage) => (
          <div
            key={stage.id}
            className={`flex-shrink-0 w-72 rounded-xl border ${STAGE_COLORS[stage.code] ?? "border-[#2A2D2C] bg-[#141716]"} p-3`}
          >
            {/* Stage header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${STAGE_DOTS[stage.code] ?? "bg-[#8B8F8D]"}`} />
                <span className="text-sm font-bold text-[#F2F0EB]">{stage.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#8B8F8D]">{stage.probability}%</span>
                <span className="rounded-full bg-[#2A2D2C] px-2 py-0.5 text-xs font-bold text-[#F2F0EB]">
                  {stage.total}
                </span>
              </div>
            </div>

            {/* Lead cards */}
            <div className="space-y-2">
              {stage.leads.length === 0 && (
                <div className="rounded-lg border border-dashed border-[#2A2D2C] py-6 text-center">
                  <p className="text-xs text-[#8B8F8D]">Sin leads</p>
                </div>
              )}
              {stage.leads.map((lead) => {
                const displayName = lead.persons?.name || lead.name || lead.phone
                const isRotten = lead.rotten_days > 0
                return (
                  <div
                    key={lead.id}
                    className={`rounded-lg border bg-[#0D0F0E] p-3 transition-all ${
                      isRotten ? "border-orange-500/40" : "border-[#2A2D2C]"
                    } ${moving === lead.id ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#F2F0EB] truncate">{displayName}</p>
                        <p className="text-xs text-[#8B8F8D]">{lead.phone}</p>
                      </div>
                      {isRotten && (
                        <span title={`${lead.rotten_days} días sin actividad`} className="text-xs text-orange-400 shrink-0">
                          🔥 {lead.rotten_days}d
                        </span>
                      )}
                    </div>

                    {lead.interest && (
                      <Badge variant="secondary" className="text-xs mb-2">{lead.interest}</Badge>
                    )}

                    {lead.lead_value && (
                      <p className="text-xs text-[#A8FF3E] mb-2">
                        ${lead.lead_value.toLocaleString("es-CO")}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-1 flex-wrap mt-2">
                      <a
                        href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded px-2 py-1 text-xs font-medium border border-[#2A2D2C] text-[#8B8F8D] hover:border-[#A8FF3E] hover:text-[#A8FF3E] transition-colors"
                      >
                        💬
                      </a>
                      {/* Move to next stage */}
                      {stagesForMove
                        .filter((s) => s.id !== lead.stage_id)
                        .slice(0, 2)
                        .map((s) => (
                          <button
                            key={s.id}
                            onClick={() => moveToStage(lead.id, s.id)}
                            disabled={moving === lead.id}
                            className="rounded px-2 py-1 text-xs font-medium border border-[#2A2D2C] text-[#8B8F8D] hover:border-[#A8FF3E] hover:text-[#A8FF3E] transition-colors disabled:opacity-40"
                          >
                            → {s.name}
                          </button>
                        ))}
                      <button
                        onClick={() => markLost(lead.id)}
                        disabled={moving === lead.id}
                        className="rounded px-2 py-1 text-xs font-medium border border-[#2A2D2C] text-[#8B8F8D] hover:border-red-500/60 hover:text-red-400 transition-colors disabled:opacity-40"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
