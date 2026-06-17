import { createClient } from "@supabase/supabase-js"

export type Provider = "meta" | "360dialog" | "twilio"

export type ProviderConfig =
  | { api_token: string }                                                       // 360dialog
  | { access_token: string; phone_number_id: string; verify_token: string }    // meta
  | { account_sid: string; auth_token: string; from_number: string }           // twilio

export type Gym = {
  id: string
  name: string
  slug: string
  plan: "esencial" | "pro" | "piloto"
  whatsapp_number: string
  webhook_url: string | null
  api_token: string | null
  provider: Provider
  provider_config: Record<string, string>
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

// ── Lookup tables ────────────────────────────────────────────

export type LeadSource = {
  id: string
  gym_id: string
  name: string
  created_at: string
}

export type LeadType = {
  id: string
  gym_id: string
  name: string
  created_at: string
}

// ── Pipeline ─────────────────────────────────────────────────

export type LeadPipeline = {
  id: string
  gym_id: string
  name: string
  rotten_days: number
  is_default: boolean
  created_at: string
  updated_at: string
}

export type LeadPipelineStage = {
  id: string
  pipeline_id: string
  name: string
  code: string
  probability: number
  sort_order: number
  created_at: string
}

// ── Person (contacto) ────────────────────────────────────────

export type ContactEntry = {
  value: string
  label: string // "whatsapp" | "personal" | "work" | etc.
}

export type Person = {
  id: string
  gym_id: string
  name: string | null
  contact_numbers: ContactEntry[]
  emails: ContactEntry[]
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ── Lead ─────────────────────────────────────────────────────

export type LeadStatus = "open" | "won" | "lost"

export type Lead = {
  id: string
  gym_id: string
  // Legacy fields (kept for backward compat)
  name: string | null
  phone: string
  email: string | null
  interest: string | null
  // CRM v2 fields
  person_id: string | null
  pipeline_id: string | null
  stage_id: string | null
  source_id: string | null
  type_id: string | null
  lead_value: number | null
  lost_reason: string | null
  closed_at: string | null
  expected_close_date: string | null
  status: LeadStatus
  last_activity_at: string | null
  created_at: string
  updated_at: string | null
  // Joined relations (when queried with select)
  persons?: Person
  lead_pipeline_stages?: LeadPipelineStage
}

// ── Activity ─────────────────────────────────────────────────

export type ActivityType = "whatsapp" | "call" | "note" | "meeting"

export type Activity = {
  id: string
  gym_id: string
  lead_id: string | null
  person_id: string | null
  type: ActivityType
  title: string | null
  comment: string | null
  additional: Record<string, unknown> | null
  is_done: boolean
  created_at: string
}

// ── Supabase clients ─────────────────────────────────────────

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
