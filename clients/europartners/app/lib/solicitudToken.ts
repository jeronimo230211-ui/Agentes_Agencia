import { createAdminClient } from './supabase-server'

// Validación del token del link fijo de pedido (/solicitud/[token] y, ahora,
// /solicitud/[token]/producto/[id]) — extraída de
// app/api/solicitud/[token]/route.ts para que la página de detalle de
// producto use exactamente el mismo patrón, no uno inventado aparte.
//
// Los tokens se generan con encode(gen_random_bytes(16|32),'hex') (migraciones
// 001/010) = hex puro. Se acepta un charset algo más amplio para no romper
// tokens viejos, pero sin , . ( ) : etc., para que el valor nunca pueda
// alterar un filtro de PostgREST.
export const TOKEN_REGEX = /^[0-9a-zA-Z_-]{8,128}$/

export type ClienteToken = { id: string; nombre: string; activo: boolean; contacto_email: string | null }

// Busca al dueño del token con dos consultas .eq() (nunca interpolando el
// token en un .or()) y devuelve cuál de los 2 links se usó.
export async function buscarClientePorToken(
  adminClient: ReturnType<typeof createAdminClient>,
  token: string
): Promise<{ cliente: ClienteToken; tipoPrecio: 'mayorista' | 'detallista' } | null> {
  if (!TOKEN_REGEX.test(token)) return null
  for (const [columna, tipoPrecio] of [
    ['token_mayorista', 'mayorista'],
    ['token_detallista', 'detallista'],
  ] as const) {
    const { data } = await adminClient
      .from('clientes')
      .select('id, nombre, activo, contacto_email')
      .eq(columna, token)
      .maybeSingle()
    if (data) return { cliente: data as ClienteToken, tipoPrecio }
  }
  return null
}
