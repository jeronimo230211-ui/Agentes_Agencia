-- ============================================================
-- LexBarbería — Schema de agendamiento (Supabase / Postgres)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- BUSINESS — un solo registro hoy (Lex Barbería), pero el shape
-- ya soporta multi-tenant si esto se productiza más adelante.
-- ============================================================
create table if not exists business (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null default 'Lex Barbería',
  slug                      text unique not null default 'lexbarberia',
  timezone                  text not null default 'America/Bogota',
  whatsapp_provider         text check (whatsapp_provider in ('360dialog', 'meta', 'twilio')),
  whatsapp_provider_config  jsonb not null default '{}'::jsonb,
  google_calendar_tokens    jsonb, -- { access_token, refresh_token, expiry_date } — cifrado a nivel de app
  cancellation_window_hours int not null default 24,
  buffer_minutes            int not null default 0, -- minutos de limpieza/descanso entre citas
  reminder_hours_before     int[] not null default '{24,2}',
  greeting                  text not null default '¡Hola! 💈 Bienvenido a Lex Barbería. ¿En qué te puedo ayudar?',
  address                   text,
  active                    boolean not null default true,
  created_at                timestamptz not null default now()
);

-- ============================================================
-- BARBERS — hoy un solo registro (Alex). El modelo soporta N
-- barberos sin cambios de schema si el negocio crece.
-- ============================================================
create table if not exists barbers (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references business(id) on delete cascade,
  name                text not null,
  phone               text,
  google_calendar_id  text, -- 'primary' o id de calendario específico una vez conectado
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

create index if not exists idx_barbers_business on barbers(business_id);

-- ============================================================
-- SERVICES — Corte, Barba, Corte + Barba, etc.
-- ============================================================
create table if not exists services (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references business(id) on delete cascade,
  name              text not null,
  duration_minutes  int not null check (duration_minutes > 0),
  price             numeric(12, 2),
  active            boolean not null default true,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists idx_services_business on services(business_id);

-- ============================================================
-- BUSINESS_HOURS — plantilla semanal recurrente por barbero.
-- Una fila por (barbero, día de la semana); `ranges` permite
-- turnos partidos (ej. mañana y tarde) sin más filas.
-- day_of_week: 0=domingo … 6=sábado
-- ranges: [{"start":"09:00","end":"13:00"},{"start":"14:00","end":"19:00"}]
-- ============================================================
create table if not exists business_hours (
  id           uuid primary key default gen_random_uuid(),
  barber_id    uuid not null references barbers(id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  ranges       jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now(),
  unique (barber_id, day_of_week)
);

-- ============================================================
-- SCHEDULE_EXCEPTIONS — overrides puntuales de un día específico:
-- cerrar el día completo, o reemplazar el horario de ese día.
-- Editar "varios días a la vez" = upsert de varias filas desde
-- el dashboard, no requiere modelo especial.
-- ============================================================
create table if not exists schedule_exceptions (
  id          uuid primary key default gen_random_uuid(),
  barber_id   uuid not null references barbers(id) on delete cascade,
  date        date not null,
  is_closed   boolean not null default true,
  ranges      jsonb, -- solo si is_closed = false: [{"start":"10:00","end":"14:00"}]
  reason      text,
  created_at  timestamptz not null default now(),
  unique (barber_id, date)
);

create index if not exists idx_schedule_exceptions_barber_date on schedule_exceptions(barber_id, date);

-- ============================================================
-- CLIENTS — clientes del barbero, identificados por WhatsApp.
-- ============================================================
create table if not exists clients (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references business(id) on delete cascade,
  name           text,
  phone          text not null,
  notes          text, -- preferencias / notas del barbero sobre el cliente
  no_show_count  int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (business_id, phone)
);

create index if not exists idx_clients_business on clients(business_id);

-- ============================================================
-- CONVERSATIONS — historial de chat de WhatsApp por cliente, para
-- que el agente mantenga contexto entre mensajes.
-- ============================================================
create table if not exists conversations (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business(id) on delete cascade,
  client_phone text not null,
  messages     jsonb not null default '[]'::jsonb, -- [{role, content, ts}]
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (business_id, client_phone)
);

drop trigger if exists trg_conversations_updated_at on conversations;
create trigger trg_conversations_updated_at before update on conversations
  for each row execute function set_updated_at();

-- ============================================================
-- RECURRING_BOOKINGS — cita periódica fija para un cliente
-- (ej. "todos los viernes 2pm"). Un job genera las citas reales
-- hacia adelante en `appointments`.
-- ============================================================
create table if not exists recurring_bookings (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references business(id) on delete cascade,
  barber_id         uuid not null references barbers(id) on delete cascade,
  service_id        uuid not null references services(id),
  client_id         uuid not null references clients(id) on delete cascade,
  day_of_week       smallint not null check (day_of_week between 0 and 6),
  start_time        time not null,
  active            boolean not null default true,
  generated_until   date, -- hasta qué fecha ya se generaron citas concretas
  created_at        timestamptz not null default now()
);

create index if not exists idx_recurring_barber on recurring_bookings(barber_id);
create index if not exists idx_recurring_client on recurring_bookings(client_id);

-- ============================================================
-- APPOINTMENTS — cita puntual. Constraint de exclusión evita
-- doble-reserva del mismo barbero a nivel de base de datos.
-- ============================================================
create table if not exists appointments (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references business(id) on delete cascade,
  barber_id             uuid not null references barbers(id) on delete cascade,
  service_id            uuid not null references services(id),
  client_id             uuid not null references clients(id) on delete cascade,
  recurring_booking_id  uuid references recurring_bookings(id) on delete set null,
  starts_at             timestamptz not null,
  ends_at               timestamptz not null,
  status                text not null default 'confirmed'
                          check (status in ('confirmed', 'cancelled', 'completed', 'no_show', 'pending_reschedule')),
  source                text not null default 'whatsapp' check (source in ('whatsapp', 'dashboard', 'recurring')),
  google_calendar_event_id text,
  notes                 text,
  confirmed_at          timestamptz, -- confirmación del cliente el día antes
  cancelled_at          timestamptz,
  cancelled_reason      text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists idx_appointments_barber_time on appointments(barber_id, starts_at);
create index if not exists idx_appointments_client on appointments(client_id);
create index if not exists idx_appointments_status on appointments(status);

-- Evita que un barbero quede doble-agendado en el mismo rango de tiempo.
alter table appointments
  add constraint appointments_no_overlap
  exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
  where (status = 'confirmed');

-- ============================================================
-- NOTIFICATIONS_LOG — auditoría de todo lo que se envía por
-- WhatsApp relacionado a una cita (recordatorios, confirmaciones,
-- avisos de cancelación masiva, solicitud de reseña).
-- ============================================================
create table if not exists notifications_log (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references business(id) on delete cascade,
  appointment_id  uuid references appointments(id) on delete cascade,
  client_id       uuid references clients(id) on delete cascade,
  type            text not null check (type in (
                    'confirmation', 'reminder_24h', 'reminder_2h', 'confirmation_request',
                    'cancellation_notice', 'reschedule_offer', 'review_request'
                  )),
  channel         text not null default 'whatsapp',
  status          text not null default 'sent' check (status in ('sent', 'failed')),
  sent_at         timestamptz not null default now()
);

create index if not exists idx_notifications_appointment on notifications_log(appointment_id);

-- ============================================================
-- BROADCASTS — registro de avisos masivos de novedad (punto 6):
-- Alex escribe un mensaje, se envía a todos los clientes con
-- cita en el rango de fechas afectado.
-- ============================================================
create table if not exists broadcasts (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references business(id) on delete cascade,
  message         text not null,
  range_start     date not null,
  range_end       date not null,
  affected_count  int not null default 0,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- updated_at triggers
-- ============================================================
drop trigger if exists trg_clients_updated_at on clients;
create trigger trg_clients_updated_at before update on clients
  for each row execute function set_updated_at();

drop trigger if exists trg_appointments_updated_at on appointments;
create trigger trg_appointments_updated_at before update on appointments
  for each row execute function set_updated_at();

-- ============================================================
-- SEED — negocio Lex Barbería + Alex + servicios base
-- (ajustar precios/duraciones reales antes de producción)
-- ============================================================
insert into business (name, slug, timezone, cancellation_window_hours, address)
select 'Lex Barbería', 'lexbarberia', 'America/Bogota', 24, ''
where not exists (select 1 from business where slug = 'lexbarberia');

insert into barbers (business_id, name)
select b.id, 'Alex'
from business b
where b.slug = 'lexbarberia'
  and not exists (select 1 from barbers where business_id = b.id);

insert into services (business_id, name, duration_minutes, price, sort_order)
select b.id, s.name, s.duration_minutes, s.price, s.sort_order
from business b
cross join (values
  ('Corte',          30, null::numeric, 0),
  ('Barba',          20, null::numeric, 1),
  ('Corte + Barba',  45, null::numeric, 2)
) as s(name, duration_minutes, price, sort_order)
where b.slug = 'lexbarberia'
  and not exists (select 1 from services where business_id = b.id);

-- ============================================================
-- RLS — activar cuando haya auth de usuarios en el dashboard.
-- Por ahora las API routes usan el service_role key (bypass).
-- ============================================================
-- alter table business enable row level security;
-- alter table barbers enable row level security;
-- alter table services enable row level security;
-- alter table business_hours enable row level security;
-- alter table schedule_exceptions enable row level security;
-- alter table clients enable row level security;
-- alter table recurring_bookings enable row level security;
-- alter table appointments enable row level security;
-- alter table notifications_log enable row level security;
-- alter table broadcasts enable row level security;
