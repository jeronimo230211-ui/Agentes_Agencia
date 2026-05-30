"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Gym, Lead, Conversation } from "@/lib/supabase"

type Stats = {
  messagesToday: number
  leadsThisWeek: number
  totalLeads: number
  totalConversations: number
  leadCaptureRate: number
}

type DashboardData = {
  gym: Gym | null
  stats: Stats
  recentLeads: Lead[]
  recentConversations: Conversation[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/gyms")
        if (!res.ok) throw new Error("No se pudo cargar el panel")
        const json = await res.json()
        setData(json)
      } catch {
        // Show demo data if no gym configured yet
        setData({
          gym: null,
          stats: {
            messagesToday: 0,
            leadsThisWeek: 0,
            totalLeads: 0,
            totalConversations: 0,
            leadCaptureRate: 0,
          },
          recentLeads: [],
          recentConversations: [],
        })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#A8FF3E] border-t-transparent" />
      </div>
    )
  }

  if (!data?.gym) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-4xl mb-4">🤖</p>
        <h2 className="text-xl font-bold text-[#F2F0EB] mb-2">Configura tu GymBot</h2>
        <p className="text-[#8B8F8D] mb-6">
          Aún no tienes un gymbot configurado. Empieza en 10 minutos.
        </p>
        <a
          href="/setup"
          className="rounded-lg bg-[#A8FF3E] px-6 py-3 font-bold text-[#0D0F0E] hover:bg-[#8FE62A] transition-colors"
        >
          Configurar ahora →
        </a>
      </div>
    )
  }

  const { gym, stats, recentLeads, recentConversations } = data

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-[#F2F0EB]">{gym.name}</h1>
        <p className="text-sm text-[#8B8F8D]">
          {gym.config?.location || gym.name} ·{" "}
          <span className="capitalize text-[#A8FF3E]">{gym.plan}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#8B8F8D]">
              Mensajes hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-[#F2F0EB]">{stats.messagesToday}</div>
            <p className="text-xs text-[#8B8F8D] mt-1">respondidos por el bot</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#8B8F8D]">
              Leads esta semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-[#A8FF3E]">{stats.leadsThisWeek}</div>
            <p className="text-xs text-[#8B8F8D] mt-1">interesados capturados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#8B8F8D]">
              Total leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-[#F2F0EB]">{stats.totalLeads}</div>
            <p className="text-xs text-[#8B8F8D] mt-1">desde el inicio</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#8B8F8D]">
              Tasa de captura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-[#F2F0EB]">
              {stats.leadCaptureRate}%
            </div>
            <p className="text-xs text-[#8B8F8D] mt-1">conversaciones → leads</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Leads */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Últimos leads</CardTitle>
              <a href="/dashboard/leads" className="text-xs text-[#A8FF3E] hover:underline">
                Ver todos →
              </a>
            </div>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-2xl mb-2">💤</p>
                <p className="text-sm text-[#8B8F8D]">
                  Aún no hay leads. El bot los capturará automáticamente.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between rounded-lg bg-[#1A1D1C] p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#F2F0EB]">
                        {lead.name || lead.phone}
                      </p>
                      <p className="text-xs text-[#8B8F8D]">{lead.phone}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="default">{lead.interest || "General"}</Badge>
                      <p className="text-xs text-[#8B8F8D] mt-1">
                        {new Date(lead.created_at).toLocaleDateString("es-CO")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Conversations */}
        <Card>
          <CardHeader>
            <CardTitle>Conversaciones recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentConversations.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-2xl mb-2">💬</p>
                <p className="text-sm text-[#8B8F8D]">
                  Conecta tu WhatsApp para ver las conversaciones aquí.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentConversations.map((conv) => {
                  const lastMsg = Array.isArray(conv.messages)
                    ? conv.messages[conv.messages.length - 1]
                    : null
                  return (
                    <div
                      key={conv.id}
                      className="rounded-lg bg-[#1A1D1C] p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-[#F2F0EB]">
                          +{conv.from_number}
                        </p>
                        {conv.lead_captured && (
                          <Badge variant="default" className="text-xs">Lead</Badge>
                        )}
                      </div>
                      {lastMsg && (
                        <p className="text-xs text-[#8B8F8D] truncate">{lastMsg.content}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* WhatsApp status */}
      {!gym.api_token && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-[#F2F0EB]">WhatsApp no conectado</p>
              <p className="text-sm text-[#8B8F8D] mt-1">
                Tu bot está configurado pero necesitas conectar 360Dialog para que responda en
                WhatsApp. Ve a{" "}
                <a href="/dashboard/config" className="text-[#A8FF3E] hover:underline">
                  Configuración
                </a>{" "}
                para agregar tu API key.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
