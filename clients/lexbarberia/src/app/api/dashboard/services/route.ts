import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase"

export async function GET() {
  const db = createServiceClient()
  const { data: business } = await db.from("business").select("id").eq("active", true).single()
  if (!business) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const { data: services } = await db.from("services").select("*").eq("business_id", business.id).order("sort_order")
  return NextResponse.json({ services: services || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.name || !body?.duration_minutes) {
    return NextResponse.json({ error: "Faltan 'name' y/o 'duration_minutes'" }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: business } = await db.from("business").select("id").eq("active", true).single()
  if (!business) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const { count } = await db.from("services").select("*", { count: "exact", head: true }).eq("business_id", business.id)

  const { data, error } = await db
    .from("services")
    .insert({
      business_id: business.id,
      name: body.name,
      duration_minutes: body.duration_minutes,
      price: body.price ?? null,
      sort_order: count ?? 0,
    })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ service: data })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.id) return NextResponse.json({ error: "Falta id" }, { status: 400 })

  const db = createServiceClient()
  const updates: Record<string, unknown> = {}
  for (const key of ["name", "duration_minutes", "price", "active", "sort_order"]) {
    if (body[key] !== undefined) updates[key] = body[key]
  }

  const { data, error } = await db.from("services").update(updates).eq("id", body.id).select("*").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ service: data })
}
