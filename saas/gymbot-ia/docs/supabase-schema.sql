-- GymBot IA — Supabase Database Schema
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- GYMS — tabla maestra de gimnasios (un registro por cliente)
-- ============================================================
create table if not exists gyms (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  slug          text unique not null,
  plan          text not null default 'piloto' check (plan in ('piloto', 'esencial', 'pro')),
  whatsapp_number text not null,
  webhook_url   text,
  api_token     text,           -- 360Dialog API key (store encrypted ideally)
  config        jsonb not null default '{
    "greeting": "¡Hola! ¿En qué te puedo ayudar?",
    "hours": "",
    "prices": "",
    "classes": "",
    "location": "",
    "contact_name": ""
  }'::jsonb,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- CONVERSATIONS — cada conversación de WhatsApp por gym
-- ============================================================
create table if not exists conversations (
  id             uuid primary key default uuid_generate_v4(),
  gym_id         uuid not null references gyms(id) on delete cascade,
  from_number    text not null,        -- número del cliente (ej: 5491123456789)
  messages       jsonb not null default '[]'::jsonb, -- array de {role, content, ts}
  lead_captured  boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists conversations_gym_id_idx on conversations(gym_id);
create index if not exists conversations_from_number_idx on conversations(from_number);
create index if not exists conversations_created_at_idx on conversations(created_at desc);

-- ============================================================
-- LEADS — leads capturados por el bot
-- ============================================================
create table if not exists leads (
  id          uuid primary key default uuid_generate_v4(),
  gym_id      uuid not null references gyms(id) on delete cascade,
  name        text,
  phone       text not null,
  email       text,
  interest    text,   -- 'Membresía', 'Clases', 'Precios', 'General'
  created_at  timestamptz not null default now()
);

create index if not exists leads_gym_id_idx on leads(gym_id);
create index if not exists leads_created_at_idx on leads(created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Por simplicidad en el MVP, las API routes usan service_key
-- que bypasea RLS. Activar RLS por seguridad en producción.
-- ============================================================
alter table gyms enable row level security;
alter table conversations enable row level security;
alter table leads enable row level security;

-- Política para service_role (bypass total — para las API routes)
-- Las API routes usan SUPABASE_SERVICE_KEY → acceso total
-- No se necesitan políticas adicionales para eso.

-- ============================================================
-- DATOS DE PRUEBA (opcional — borrar antes de producción)
-- ============================================================
-- insert into gyms (name, slug, plan, whatsapp_number, config) values (
--   'GymBot Demo',
--   'gymbot-demo',
--   'esencial',
--   '+57 300 0000000',
--   '{
--     "greeting": "¡Hola! 👋 Bienvenido al demo de GymBot. Soy el asistente virtual. ¿En qué te puedo ayudar?",
--     "hours": "Lunes a viernes 6am-10pm. Sábados 7am-8pm. Domingos 8am-2pm.",
--     "prices": "Mensual $89.000. Trimestral $240.000. Anual $800.000.",
--     "classes": "Spinning (L-V 7am, 12pm, 6pm), Yoga (Ma-Ju 8am, 7pm), CrossFit (todos los días 6am y 7pm).",
--     "location": "Calle 63 #80a-134, Laureles, Medellín",
--     "contact_name": "Carlos"
--   }'::jsonb
-- );
