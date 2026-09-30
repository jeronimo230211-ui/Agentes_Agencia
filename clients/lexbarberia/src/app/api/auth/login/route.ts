import { NextRequest, NextResponse } from "next/server"
import { AUTH_COOKIE_NAME, REMEMBER_MAX_AGE, checkCredentials, expectedSessionValue } from "@/lib/auth"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const { username, password, remember } = body || {}

  if (!username || !password || !checkCredentials(username, password)) {
    return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(AUTH_COOKIE_NAME, expectedSessionValue(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: REMEMBER_MAX_AGE } : {}), // sin maxAge = cookie de sesión (se borra al cerrar el navegador)
  })
  return res
}
