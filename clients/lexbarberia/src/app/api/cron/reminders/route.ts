import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase"
import { sendDueReminders } from "@/lib/reminders"
import type { Business } from "@/types/scheduling"

// Lo llama Supabase (pg_cron + pg_net) cada 15 min — ver db/migrations/004_reminders.sql.
// El plan gratis de Vercel solo permite crons diarios, por eso el reloj vive en Supabase.
// Protegido con CRON_SECRET (Authorization: Bearer <secreto>), el mismo esquema que usa Vercel Cron.

async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const db = createServiceClient()
  const { data: business } = await db.from("business").select("*").eq("active", true).single()
  if (!business) return NextResponse.json({ error: "Negocio no configurado" }, { status: 404 })

  const result = await sendDueReminders(db, business as Business)
  return NextResponse.json(result)
}

export const GET = run
export const POST = run
