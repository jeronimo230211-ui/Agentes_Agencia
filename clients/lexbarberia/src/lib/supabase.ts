import { createClient } from "@supabase/supabase-js"

// Usada desde API routes (server-side) — bypasea RLS con el service key.
// Nunca importar este archivo desde un componente cliente.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_KEY en las variables de entorno")
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
