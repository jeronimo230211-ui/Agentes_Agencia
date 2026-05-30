import { createClient } from "@supabase/supabase-js"

export type Gym = {
  id: string
  name: string
  slug: string
  plan: "esencial" | "pro" | "piloto"
  whatsapp_number: string
  webhook_url: string | null
  api_token: string | null
  config: GymConfig
  active: boolean
  created_at: string
}

export type GymConfig = {
  greeting: string
  hours: string
  prices: string
  classes: string
  location: string
  contact_name: string
}

export type Conversation = {
  id: string
  gym_id: string
  from_number: string
  messages: Message[]
  lead_captured: boolean
  created_at: string
}

export type Message = {
  role: "user" | "assistant"
  content: string
  ts: string
}

export type Lead = {
  id: string
  gym_id: string
  name: string | null
  phone: string
  email: string | null
  interest: string | null
  created_at: string
}

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_KEY!
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  })
}
