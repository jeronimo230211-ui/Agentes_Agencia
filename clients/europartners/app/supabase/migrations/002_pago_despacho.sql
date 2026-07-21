-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 002 — Pago/abono (T4) + activar despacho (T5/T6)
-- Incremental, no destructiva — ver nota en migración 001.
-- ══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Pago / abono sobre la proforma ───────────────────────────
alter table proformas
  add column if not exists monto_abono_requerido numeric(12,2),
  add column if not exists monto_abono_recibido  numeric(12,2),
  add column if not exists fecha_abono           date,
  add column if not exists comprobante_url        text,
  add column if not exists estado_pago            text not null default 'pendiente'
                           check (estado_pago in ('pendiente', 'parcial', 'pagado')),
  add column if not exists fecha_envio_cliente     date;

-- ── Link temporal para que el cliente suba su comprobante ────
create table if not exists tokens_pago (
  id          uuid primary key default gen_random_uuid(),
  proforma_id uuid references proformas(id) on delete cascade not null,
  token       text unique not null default encode(gen_random_bytes(32), 'hex'),
  expira_at   timestamptz not null default (now() + interval '30 days'),
  created_at  timestamptz default now()
);

create index if not exists idx_tokens_pago_proforma on tokens_pago(proforma_id);

alter table tokens_pago enable row level security;
create policy "service_all" on tokens_pago for all using (auth.role() = 'service_role');

-- ── despachos ya existe (schema_v2.sql) con proforma_id, naviera,
--    numero_bl, puertos, fechas, shipping_fee_usd, estado y URLs de
--    documentos — no requiere cambios de estructura, solo API/UI.
