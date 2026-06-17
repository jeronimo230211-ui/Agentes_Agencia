import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase"
import type { GymConfig, Provider } from "@/lib/supabase"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/[ñ]/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

// POST /api/gyms — create gym
export async function POST(request: NextRequest) {
  let body: {
    name?: string
    city?: string
    country?: string
    contactName?: string
    whatsappNumber?: string
    config?: GymConfig
    apiToken?: string | null
    provider?: Provider
    providerConfig?: Record<string, string>
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { name, city, country, contactName, whatsappNumber, config, apiToken, provider, providerConfig } = body

  if (!name || !whatsappNumber) {
    return Response.json({ error: "name and whatsappNumber are required" }, { status: 400 })
  }

  const db = createServiceClient()

  const baseSlug = slugify(name)
  let slug = baseSlug
  let attempt = 0
  while (attempt < 10) {
    const { data: existing } = await db
      .from("gyms")
      .select("id")
      .eq("slug", slug)
      .single()
    if (!existing) break
    attempt++
    slug = `${baseSlug}-${attempt}`
  }

  const gymConfig: GymConfig = config || {
    greeting: `¡Hola! 👋 Bienvenido a ${name}. ¿En qué te puedo ayudar?`,
    hours: "Consultar horarios directamente",
    prices: "Consultar precios directamente",
    classes: "Consultar clases disponibles",
    location: city || "",
    contact_name: contactName || "",
  }

  const { data, error } = await db
    .from("gyms")
    .insert({
      name,
      slug,
      plan: "piloto",
      whatsapp_number: whatsappNumber,
      api_token: apiToken || null,
      provider: provider || "meta",
      provider_config: providerConfig || {},
      config: gymConfig,
      active: true,
    })
    .select()
    .single()

  if (error) {
    console.error("Supabase insert error:", error)
    return Response.json({ error: "Error al crear el gimnasio" }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}

// GET /api/gyms — get gym data + stats (simplified: returns first active gym)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const resource = searchParams.get("resource")
  const gymId = searchParams.get("gymId")

  const db = createServiceClient()

  if (resource === "leads") {
    const query = db
      .from("leads")
      .select(`
        id, name, phone, email, interest, status, lead_value,
        stage_id, person_id, created_at, last_activity_at, updated_at,
        persons(id, name, contact_numbers),
        lead_pipeline_stages(id, name, code, probability)
      `)
      .order("created_at", { ascending: false })
      .limit(100)

    if (gymId) query.eq("gym_id", gymId)

    const { data: leads } = await query
    return Response.json({ leads: leads || [] })
  }

  // Return first gym + dashboard stats
  const { data: gym } = await db
    .from("gyms")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (!gym) return Response.json({ gym: null, stats: null, recentLeads: [], recentConversations: [] })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [{ count: messagesToday }, { count: leadsThisWeek }, { count: totalLeads }, { data: allConvs }, { data: recentLeads }, { data: recentConversations }] =
    await Promise.all([
      db
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("gym_id", gym.id)
        .gte("created_at", today.toISOString()),
      db
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("gym_id", gym.id)
        .gte("created_at", weekAgo.toISOString()),
      db
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("gym_id", gym.id),
      db
        .from("conversations")
        .select("lead_captured", { count: "exact" })
        .eq("gym_id", gym.id),
      db
        .from("leads")
        .select("*")
        .eq("gym_id", gym.id)
        .order("created_at", { ascending: false })
        .limit(5),
      db
        .from("conversations")
        .select("*")
        .eq("gym_id", gym.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ])

  const totalConvs = allConvs?.length || 0
  const capturedConvs = allConvs?.filter((c) => c.lead_captured).length || 0
  const leadCaptureRate = totalConvs > 0 ? Math.round((capturedConvs / totalConvs) * 100) : 0

  return Response.json({
    gym,
    stats: {
      messagesToday: messagesToday || 0,
      leadsThisWeek: leadsThisWeek || 0,
      totalLeads: totalLeads || 0,
      totalConversations: totalConvs,
      leadCaptureRate,
    },
    recentLeads: recentLeads || [],
    recentConversations: recentConversations || [],
  })
}

// PUT /api/gyms — update gym config
export async function PUT(request: NextRequest) {
  let body: { id?: string; config?: GymConfig; apiToken?: string; providerConfig?: Record<string, string>; provider?: Provider }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { id, config, apiToken, providerConfig, provider } = body

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 })
  }

  const db = createServiceClient()

  const updates: Record<string, unknown> = {}
  if (config) updates.config = config
  if (apiToken) updates.api_token = apiToken
  if (providerConfig) updates.provider_config = providerConfig
  if (provider) updates.provider = provider

  const { data, error } = await db
    .from("gyms")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return Response.json({ error: "Error al actualizar" }, { status: 500 })
  }

  return Response.json(data)
}
