import { NextRequest, NextResponse } from "next/server"
import { AUTH_COOKIE_NAME, expectedSessionValue } from "@/lib/auth"

export function proxy(request: NextRequest) {
  const session = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const isAuthed = Boolean(session) && session === expectedSessionValue()

  if (isAuthed) return NextResponse.next()

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const loginUrl = new URL("/login", request.url)
  loginUrl.searchParams.set("from", request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/dashboard/:path*", "/api/auth/google/:path*"],
}
