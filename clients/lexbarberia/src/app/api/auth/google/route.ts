import { NextRequest, NextResponse } from "next/server"
import { getGoogleAuthUrl } from "@/lib/google-calendar"

export async function GET(request: NextRequest) {
  const redirectUri = `${request.nextUrl.origin}/api/auth/google/callback`
  const url = getGoogleAuthUrl(redirectUri)
  return NextResponse.redirect(url)
}
