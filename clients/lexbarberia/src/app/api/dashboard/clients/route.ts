import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  // El texto va dentro de un filtro .or() de PostgREST: comas, paréntesis, comodines y comillas
  // alterarían el filtro (o lo romperían con nombres como "Pérez, Juan"), así que se quitan.
  const q = searchParams.get("q")?.replace(/[,()%*"\\]/g, " ").trim().slice(0, 50)

  const db = createServiceClient()
  const { data: business } = await db.from("business").select("id").eq("active", true).single()
  if (!business) return NextResponse.json({ error: "not_found" }, { status: 404 })

  let query = db.from("clients").select("*").eq("business_id", business.id).order("name")
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)

  const { data: clients, error } = await query.limit(20)
  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 })
  return NextResponse.json({ clients: clients || [] })
}
