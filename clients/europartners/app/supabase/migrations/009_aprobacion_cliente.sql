-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 009 — Aprobación del cliente + Invoice
-- Incremental, no destructiva — ver nota en migración 001.
--
-- Cierra el hueco entre "proforma enviada" y "cliente paga": hoy
-- enviarProformaCliente() mandaba el botón de pago en el mismo
-- correo que la proforma, sin que el cliente la aprobara primero.
-- 'cambios_solicitados' es un estado nuevo, distinto de 'rechazada'
-- (que es el rechazo INTERNO de Marta antes de mandarla) — este es
-- el cliente pidiendo ajustes sobre una proforma que ya vio.
-- ══════════════════════════════════════════════════════════════

alter table proformas drop constraint if exists proformas_estado_check;
alter table proformas add constraint proformas_estado_check
  check (estado in ('borrador', 'en_revision', 'aprobada', 'rechazada', 'enviada', 'facturada', 'cambios_solicitados'));

alter table proformas add column if not exists comentario_cliente text;

-- ── Token de aprobación para el CLIENTE (distinto de tokens_aprobacion,
--    que es el link interno de Marta) ───────────────────────────
create table if not exists tokens_aprobacion_cliente (
  id          uuid primary key default gen_random_uuid(),
  proforma_id uuid references proformas(id) on delete cascade not null,
  token       text unique not null default encode(gen_random_bytes(32), 'hex'),
  usado       boolean default false,
  expira_at   timestamptz not null default (now() + interval '7 days'),
  created_at  timestamptz default now()
);

create index if not exists idx_tokens_aprobacion_cliente_pf on tokens_aprobacion_cliente(proforma_id);

alter table tokens_aprobacion_cliente enable row level security;

create policy "service_all" on tokens_aprobacion_cliente for all using (auth.role() = 'service_role');
