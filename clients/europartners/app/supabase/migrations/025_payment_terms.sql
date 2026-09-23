-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 025 — Selector "Payment Terms" (proforma + default cliente)
-- Incremental, no destructiva — ver nota en migración 001.
--
-- Pedido por Jero (2026-09-22): agregar un campo "Payment Terms" a la
-- proforma, editable desde el cotizador con un <select> real (a
-- diferencia de Incoterm/Freight/Insurance, que son <input> con
-- <datalist> de sugerencias — ver migración 016) alimentado desde una
-- tabla de opciones administrable desde la misma pantalla (modal "+
-- agregar", sin pantalla de administración aparte).
--
-- Se sigue el mismo patrón que 018_defaults_condiciones_comerciales_cliente.sql
-- para el default por cliente (columna `payment_terms_default` en
-- `clientes`, copiada a `proformas.payment_terms` al crear una proforma
-- nueva, tanto desde POST /api/proformas como desde
-- POST /api/solicitudes/[id]/convertir-proforma).
--
-- `proformas.payment_terms` es texto libre SIN foreign key hacia
-- `payment_terms_opciones` — se referencia por valor, igual que
-- incoterm/freight/insurance hoy (campos "libres pero sugeridos"): así
-- una proforma vieja no se rompe si más adelante se edita/desactiva la
-- opción que se usó, y es consistente con el resto de campos de
-- condiciones comerciales de este módulo.
-- ══════════════════════════════════════════════════════════════

-- ── Tabla de opciones administrables de Payment Terms ────────────
create table if not exists payment_terms_opciones (
  id         uuid primary key default gen_random_uuid(),
  valor      text not null,
  activo     boolean not null default true,
  orden      int,
  created_at timestamptz default now()
);

create index if not exists idx_payment_terms_opciones_activo on payment_terms_opciones(activo);

-- Seed inicial (orden 1 y 2) — confirmado con Jero.
insert into payment_terms_opciones (valor, activo, orden)
values
  ('15 days before arrival date', true, 1),
  ('30% in advance and 70% 5 days before arrival date', true, 2)
on conflict do nothing;

-- ── RLS ────────────────────────────────────────────────────────
-- Mismo patrón que TODAS las demás tablas con RLS de este schema
-- (pagos, solicitudes, proformas_china, etc. — ver comentario extenso
-- en 021_tabla_pagos.sql): "read_auth" para cualquier usuario
-- autenticado + "service_all" para service_role. La restricción de rol
-- (operaciones/admin) para poder crear una opción nueva se implementa
-- en el endpoint (app/api/payment-terms/route.ts), no en RLS.
alter table payment_terms_opciones enable row level security;

create policy "read_auth" on payment_terms_opciones for select using (auth.role() = 'authenticated');
create policy "service_all" on payment_terms_opciones for all using (auth.role() = 'service_role');

-- ── `proformas.payment_terms` y `clientes.payment_terms_default` ──
alter table proformas
  add column if not exists payment_terms text;

alter table clientes
  add column if not exists payment_terms_default text;
