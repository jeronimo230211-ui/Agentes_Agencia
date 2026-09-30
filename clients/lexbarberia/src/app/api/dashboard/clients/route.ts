import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim()

  const db = createServiceClient()
  const { data: business } = await db.from("business").select("id").eq("active", true).single()
  if (!business) return NextResponse.json({ error: "not_found" }, { status: 404 })

  let query = db.from("clients").select("*").eq("business_id", business.id).order("name")
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)

  const { data: clients } = await query.limit(20)
  return NextResponse.json({ clients: clients || [] })
}
