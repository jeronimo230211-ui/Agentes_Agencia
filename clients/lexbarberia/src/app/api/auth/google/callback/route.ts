import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens } from "@/lib/google-calendar"
import { createServiceClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const error = request.nextUrl.searchParams.get("error")
  const redirectBase = `${request.nextUrl.origin}/dashboard/ajustes`

  if (error || !code) {
    return NextResponse.redirect(`${redirectBase}?google=denied`)
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/auth/google/callback`
    const tokens = await exchangeCodeForTokens(code, redirectUri)

    const db = createServiceClient()
    const { data: business } = await db.from("business").select("id").eq("active", true).single()
    if (!business) return NextResponse.redirect(`${redirectBase}?google=error`)

    await db.from("business").update({ google_calendar_tokens: tokens }).eq("id", business.id)

    return NextResponse.redirect(`${redirectBase}?google=connected`)
  } catch (err) {
    console.error("[google-callback] Error:", err)
    return NextResponse.redirect(`${redirectBase}?google=error`)
  }
}
