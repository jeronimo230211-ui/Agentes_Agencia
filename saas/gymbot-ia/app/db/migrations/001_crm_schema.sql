-- ============================================================
-- GymBot IA — CRM Schema v2
-- Inspirado en Krayin Laravel CRM (MIT)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Lead Sources ──────────────────────────────────────────
create table if not exists lead_sources (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid references gyms(id) on delete cascade,
  name        text not null,
  created_at  timestamptz default now()
);

-- ── 2. Lead Types ────────────────────────────────────────────
create table if not exists lead_types (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid references gyms(id) on delete cascade,
  name        text not null,
  created_at  timestamptz default now()
);

-- ── 3. Lead Pipelines ────────────────────────────────────────
create table if not exists lead_pipelines (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid references gyms(id) on delete cascade not null,
  name         text not null,
  rotten_days  int default 7,
  is_default   boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ── 4. Pipeline Stages ───────────────────────────────────────
create table if not exists lead_pipeline_stages (
  id           uuid primary key default gen_random_uuid(),
  pipeline_id  uuid references lead_pipelines(id) on delete cascade not null,
  name         text not null,
  code         text not null,
  probability  int default 0,
  sort_order   int default 0,
  created_at   timestamptz default now()
);

-- ── 5. Persons (contactos separados de leads) ─────────────────
create table if not exists persons (
  id               uuid primary key default gen_random_uuid(),
  gym_id           uuid references gyms(id) on delete cascade not null,
  name             text,
  -- [{value: "+573001234567", label: "whatsapp"}]
  contact_numbers  jsonb default '[]'::jsonb,
  -- [{value: "email@...", label: "personal"}]
  emails           jsonb default '[]'::jsonb,
  custom_fields    jsonb default '{}'::jsonb,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists idx_persons_gym           on persons(gym_id);
create index if not exists idx_persons_numbers       on persons using gin(contact_numbers);

-- ── 6. Enriquecer tabla leads ─────────────────────────────────
alter table leads
  add column if not exists person_id            uuid references persons(id) on delete set null,
  add column if not exists pipeline_id          uuid references lead_pipelines(id) on delete set null,
  add column if not exists stage_id             uuid references lead_pipeline_stages(id) on delete set null,
  add column if not exists source_id            uuid references lead_sources(id) on delete set null,
  add column if not exists type_id              uuid references lead_types(id) on delete set null,
  add column if not exists lead_value           numeric(12,4),
  add column if not exists lost_reason          text,
  add column if not exists closed_at            timestamptz,
  add column if not exists expected_close_date  date,
  add column if not exists status               text default 'open',
  add column if not exists last_activity_at     timestamptz,
  add column if not exists updated_at           timestamptz default now();

create index if not exists idx_leads_stage     on leads(stage_id);
create index if not exists idx_leads_pipeline  on leads(pipeline_id);
create index if not exists idx_leads_person    on leads(person_id);

-- ── 7. Activities ────────────────────────────────────────────
create table if not exists activities (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid references gyms(id) on delete cascade not null,
  lead_id     uuid references leads(id) on delete cascade,
  person_id   uuid references persons(id) on delete cascade,
  -- 'whatsapp' | 'call' | 'note' | 'meeting'
  type        text not null default 'note',
  title       text,
  comment     text,
  additional  jsonb,
  is_done     boolean default false,
  created_at  timestamptz default now()
);

create index if not exists idx_activities_lead   on activities(lead_id);
create index if not exists idx_activities_gym    on activities(gym_id);
create index if not exists idx_activities_person on activities(person_id);

-- ── Función: rotten_days de un lead ──────────────────────────
-- Retorna cuántos días lleva el lead sin cambiar de etapa
-- comparado con el umbral del pipeline.
create or replace function lead_rotten_days(
  p_created_at timestamptz,
  p_last_activity_at timestamptz,
  p_rotten_days int
) returns int language sql immutable as $$
  select greatest(0,
    extract(day from now() - coalesce(p_last_activity_at, p_created_at))::int
    - p_rotten_days
  )
$$;

-- ============================================================
-- SEED: Pipeline por defecto para cada gym existente
-- ============================================================

insert into lead_pipelines (gym_id, name, rotten_days, is_default)
select id, 'Pipeline Principal', 7, true
from gyms
where not exists (
  select 1 from lead_pipelines where gym_id = gyms.id
);

insert into lead_pipeline_stages (pipeline_id, name, code, probability, sort_order)
select
  p.id,
  s.name,
  s.code,
  s.probability,
  s.sort_order
from lead_pipelines p
cross join (values
  ('Prospecto',       'prospecto',   0,   0),
  ('Contactado',      'contactado',  20,  1),
  ('Trial / Visita',  'trial',       50,  2),
  ('Inscrito',        'inscrito',    100, 3),
  ('Perdido',         'perdido',     0,   4)
) as s(name, code, probability, sort_order)
where p.is_default = true
  and not exists (
    select 1 from lead_pipeline_stages where pipeline_id = p.id
  );

insert into lead_sources (gym_id, name)
select g.id, s.name
from gyms g
cross join (values
  ('WhatsApp'), ('Instagram'), ('Referido'), ('Página web'), ('Otro')
) as s(name)
where not exists (
  select 1 from lead_sources where gym_id = g.id and name = s.name
);

insert into lead_types (gym_id, name)
select g.id, t.name
from gyms g
cross join (values
  ('Membresía'), ('Clase suelta'), ('Personal Training'), ('Plan Nutricional')
) as t(name)
where not exists (
  select 1 from lead_types where gym_id = g.id and name = t.name
);

-- ============================================================
-- MIGRATE: Crear persons para leads existentes
-- ============================================================

-- Un person por número único por gym
insert into persons (gym_id, name, contact_numbers)
select distinct on (l.gym_id, l.phone)
  l.gym_id,
  l.name,
  jsonb_build_array(
    jsonb_build_object('value', l.phone, 'label', 'whatsapp')
  )
from leads l
where l.phone is not null
  and not exists (
    select 1 from persons p
    where p.gym_id = l.gym_id
      and p.contact_numbers @> jsonb_build_array(
            jsonb_build_object('value', l.phone, 'label', 'whatsapp')
          )
  )
order by l.gym_id, l.phone, l.created_at asc;

-- Vincular leads a su person
update leads l
set
  person_id       = p.id,
  last_activity_at = l.created_at
from persons p
where l.person_id is null
  and l.phone is not null
  and p.gym_id = l.gym_id
  and p.contact_numbers @> jsonb_build_array(
        jsonb_build_object('value', l.phone, 'label', 'whatsapp')
      );

-- Asignar leads existentes al pipeline por defecto (etapa Prospecto)
update leads l
set
  pipeline_id = lp.id,
  stage_id    = (
    select id from lead_pipeline_stages
    where pipeline_id = lp.id
    order by sort_order asc
    limit 1
  )
from lead_pipelines lp
where l.pipeline_id is null
  and lp.gym_id = l.gym_id
  and lp.is_default = true;

-- ============================================================
-- RLS: Row Level Security
-- (Activar después de configurar auth en Supabase)
-- ============================================================

-- alter table lead_pipelines enable row level security;
-- alter table lead_pipeline_stages enable row level security;
-- alter table persons enable row level security;
-- alter table activities enable row level security;

-- create policy "gym_scope" on lead_pipelines
--   using (gym_id in (select gym_id from gym_users where user_id = auth.uid()));
