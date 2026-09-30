// Autenticación mínima de un solo usuario (Alex) mientras el proyecto está
// en fase de pruebas. No hay tabla de usuarios ni roles — es un candado
// simple para que el dashboard no quede abierto a cualquiera con la URL.
//
// Sin hashing: el valor de la cookie es directamente el secreto compartido
// (guardado solo en variables de entorno, cookie httpOnly). Evita usar el
// módulo "crypto" de Node, que no corre en el Edge Runtime del middleware.

export const AUTH_COOKIE_NAME = "lb_session"
export const REMEMBER_MAX_AGE = 60 * 60 * 24 * 400 // ~400 días (tope permitido por los navegadores)

export function checkCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.DASHBOARD_USERNAME
  const expectedPass = process.env.DASHBOARD_PASSWORD
  if (!expectedUser || !expectedPass) return false
  return username === expectedUser && password === expectedPass
}

export function expectedSessionValue(): string {
  const secret = process.env.DASHBOARD_SESSION_SECRET
  if (!secret) throw new Error("Falta DASHBOARD_SESSION_SECRET")
  return secret
}
