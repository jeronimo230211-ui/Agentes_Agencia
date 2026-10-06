-- ============================================================
-- LexBarbería — Cola de mensajes entrantes por cliente + candado
-- Ejecutar en: Supabase Dashboard → SQL Editor (ANTES de desplegar
-- el código que la usa).
--
-- Problema real: los clientes mandan varios mensajes cortos seguidos;
-- cada uno disparaba una respuesta en paralelo que leía el mismo
-- historial y al guardar pisaba la otra (y podía agendar doble).
-- Ahora cada mensaje entra a esta cola y un solo proceso por teléfono
-- (candado en conversations.processing_until) los responde en orden.
-- ============================================================

create table if not exists inbound_messages (
  id              text primary key,          -- wamid de WhatsApp (idempotencia ante reintentos de Meta)
  business_id     uuid not null references business(id) on delete cascade,
  client_phone    text not null,
  body            text not null,
  profile_name    text,
  button_payload  text,                       -- botones de plantillas (ej. recordatorio)
  received_at     timestamptz not null default now(),
  processed_at    timestamptz
);

create index if not exists idx_inbound_pending
  on inbound_messages (business_id, client_phone, received_at)
  where processed_at is null;

-- Candado por cliente: quien lo tenga vigente es el único que responde.
alter table conversations add column if not exists processing_until timestamptz;

-- Recordatorios: máximo uno por cita, garantizado por la base de datos
-- (antes solo se revisaba en código y dos ejecuciones simultáneas podían duplicarlo).
create unique index if not exists uq_notifications_reminder_once
  on notifications_log (appointment_id, type)
  where type = 'reminder_2h';
