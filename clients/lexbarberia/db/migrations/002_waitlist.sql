-- ============================================================
-- LexBarbería — Lista de espera
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

create table if not exists waitlist (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references business(id) on delete cascade,
  barber_id     uuid not null references barbers(id) on delete cascade,
  client_id     uuid not null references clients(id) on delete cascade,
  service_id    uuid not null references services(id),
  requested_date date not null,
  status        text not null default 'waiting' check (status in ('waiting', 'notified', 'booked', 'cancelled')),
  created_at    timestamptz not null default now(),
  notified_at   timestamptz
);

create index if not exists idx_waitlist_barber_status on waitlist(barber_id, status);
create index if not exists idx_waitlist_client on waitlist(client_id);

-- Nuevo tipo de notificación: aviso de que se abrió un cupo que alguien esperaba.
alter table notifications_log drop constraint if exists notifications_log_type_check;
alter table notifications_log add constraint notifications_log_type_check check (type in (
  'confirmation', 'reminder_24h', 'reminder_2h', 'confirmation_request',
  'cancellation_notice', 'reschedule_offer', 'review_request', 'waitlist_opening'
));
