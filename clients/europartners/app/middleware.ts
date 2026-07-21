import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/dashboard', '/catalogo', '/precios', '/cotizador', '/aprobacion', '/historial', '/facturador', '/solicitudes', '/despachos', '/reportes']
const AUTH_PATHS = ['/login']
const PUBLIC_PATHS = ['/aprobacion-token', '/solicitud/', '/pago/'] // Marta aprueba, el cliente pide y paga, todo por link sin login

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  const path = req.nextUrl.pathname
  const isProtected = PROTECTED_PATHS.some(p => path.startsWith(p))
  const isAuthRoute = AUTH_PATHS.some(p => path.startsWith(p))
  const isPublic = PUBLIC_PATHS.some(p => path.startsWith(p))

  if (isPublic) return res

  if (isProtected && !session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
