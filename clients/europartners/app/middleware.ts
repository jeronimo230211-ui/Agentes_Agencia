import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/dashboard', '/catalogo', '/cotizador', '/aprobacion', '/historial', '/facturador', '/solicitudes', '/despachos', '/reportes', '/proformas', '/proformas-china', '/finanzas']
const AUTH_PATHS = ['/login']
const PUBLIC_PATHS = ['/aprobacion-token', '/aprobacion-cliente', '/solicitud/', '/solicitud-editar/', '/pago/', '/emily/'] // Marta aprueba, el cliente pide/aprueba/paga, Emily cotiza, todo por link sin login

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some(p => path.startsWith(p))

  // Causa raíz real de la pérdida de sesión reportada por QA (29-oct-2026):
  // antes, getSession() se llamaba para TODAS las rutas -- incluidas las
  // públicas (/solicitud, /pago, /emily, etc.) -- antes de siquiera mirar
  // isPublic. getSession() del paquete auth-helpers-nextjs intenta refrescar
  // el access token si está vencido, usando el refresh_token de la cookie.
  // El refresh_token es de un solo uso (Supabase lo rota). Cuando el token
  // de un admin está por vencer y en la misma pestaña/navegador se disparan
  // varias requests casi simultáneas (la navegación de /cotizador en sí +
  // sus fetch a /api/* + esta llamada extra a una ruta pública), CADA una
  // ejecuta su propio getSession() con el MISMO refresh_token viejo. Solo
  // una gana el refresh; las demás reciben "Invalid Refresh Token: Already
  // Used" y Supabase responde a eso cerrando la sesión del lado del cliente
  // (borra la cookie en su propia respuesta) -- sin importar que la
  // request perdedora fuera a una página pública que ni necesitaba sesión.
  // Si esa respuesta que borra la cookie es la que el navegador aplica al
  // final, la sesión del admin queda inválida sin aviso y sin poder
  // recuperarla (el refresh_token ya fue rotado), aunque el usuario nunca
  // hizo logout. Cortar aquí para rutas públicas, ANTES de tocar Supabase,
  // elimina esa fuente de refresh-attempts innecesarios y reduce la
  // ventana de la carrera; no resuelve el riesgo de fondo (que cualquier
  // ráfaga de fetch concurrentes a /api/* en rutas protegidas, cada una con
  // su propio createRouteHandlerClient().auth.getSession(), puede seguir
  // chocando entre sí) pero esa parte requiere centralizar el refresh y no
  // se toca en este fix por ser un cambio de arquitectura de auth, no un
  // bug puntual.
  if (isPublic) return NextResponse.next()

  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  const isProtected = PROTECTED_PATHS.some(p => path.startsWith(p))
  const isAuthRoute = AUTH_PATHS.some(p => path.startsWith(p))

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
