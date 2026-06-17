import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase"

// GET /api/pipeline — pipeline stages + leads grouped by stage
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const gymId = searchParams.get("gymId")

  const db = createServiceClient()

  // Get first active gym if gymId not provided
  let resolvedGymId = gymId
  if (!resolvedGymId) {
    const { data: gym } = await db
      .from("gyms")
      .select("id")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
    resolvedGymId = gym?.id || null
  }

  if (!resolvedGymId) {
    return Response.json({ pipeline: null, stages: [], leads: [] })
  }

  // Load default pipeline
  const { data: pipeline } = await db
    .from("lead_pipelines")
    .select("*, lead_pipeline_stages(id, name, code, probability, sort_order)")
    .eq("gym_id", resolvedGymId)
    .eq("is_default", true)
    .single()

  if (!pipeline) {
    return Response.json({ pipeline: null, stages: [], leads: [] })
  }

  const stages = (pipeline.lead_pipeline_stages as { id: string; name: string; code: string; probability: number; sort_order: number }[])
    .sort((a, b) => a.sort_order - b.sort_order)

  // Load leads per stage, joined with person data
  const { data: leads } = await db
    .from("leads")
    .select(`
      id, name, phone, interest, status, lead_value,
      stage_id, person_id, created_at, last_activity_at,
      persons(id, name, contact_numbers)
    `)
    .eq("gym_id", resolvedGymId)
    .eq("pipeline_id", pipeline.id)
    .neq("status", "lost")
    .order("created_at", { ascending: false })

  // Group by stage
  const leadsByStage: Record<string, typeof leads> = {}
  for (const stage of stages) {
    leadsByStage[stage.id] = []
  }
  for (const lead of leads || []) {
    if (lead.stage_id && leadsByStage[lead.stage_id]) {
      leadsByStage[lead.stage_id]!.push(lead)
    }
  }

  // Compute rotten leads (days since last_activity > pipeline.rotten_days)
  const rottenThreshold = pipeline.rotten_days * 24 * 60 * 60 * 1000
  const now = Date.now()

  const stagesWithLeads = stages.map((stage) => {
    const stageLeads = (leadsByStage[stage.id] || []).map((lead) => {
      const lastActivity = lead.last_activity_at || lead.created_at
      const idleMs = now - new Date(lastActivity).getTime()
      const rottenDays = Math.max(0, Math.floor(idleMs / (24 * 60 * 60 * 1000)) - pipeline.rotten_days)
      return { ...lead, rotten_days: rottenDays }
    })
    return { ...stage, leads: stageLeads, total: stageLeads.length }
  })

  return Response.json({
    pipeline: { id: pipeline.id, name: pipeline.name, rotten_days: pipeline.rotten_days },
    stages: stagesWithLeads,
  })
}

// PATCH /api/pipeline — move lead to a different stage
export async function PATCH(request: NextRequest) {
  let body: { leadId?: string; stageId?: string; status?: string }
  try { body = await request.json() } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { leadId, stageId, status } = body
  if (!leadId) return Response.json({ error: "leadId required" }, { status: 400 })

  const db = createServiceClient()

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
  }
  if (stageId) updates.stage_id = stageId
  if (status) {
    updates.status = status
    if (status === "won" || status === "lost") updates.closed_at = new Date().toISOString()
  }

  const { data, error } = await db
    .from("leads")
    .update(updates)
    .eq("id", leadId)
    .select("id, stage_id, status")
    .single()

  if (error) return Response.json({ error: "Error al actualizar lead" }, { status: 500 })
  return Response.json(data)
}
