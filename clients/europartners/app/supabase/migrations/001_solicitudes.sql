-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 001 — Solicitudes de cliente (T1)
-- Incremental, no destructiva. NO usar drop table aquí — la base
-- ya tiene datos vivos (proformas, historial). Ver nota en el plan
-- sobre por qué schema_v2.sql no debe volver a correrse.
-- ══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Link fijo de pedido por cliente ──────────────────────────
alter table clientes
  add column if not exists token_solicitud text unique
  default encode(gen_random_bytes(16), 'hex');

-- Rellenar el token para clientes que ya existían antes de esta migración
update clientes set token_solicitud = encode(gen_random_bytes(16), 'hex')
  where token_solicitud is null;

-- ── Solicitudes ───────────────────────────────────────────────
create table if not exists solicitudes (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid references clientes(id) not null,
  estado        text not null default 'pendiente'
                check (estado in ('pendiente', 'revisada', 'convertida', 'descartada')),
  notas_cliente text,
  revisada_por  uuid references usuarios(id),
  proforma_id   uuid references proformas(id),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists solicitud_lineas (
  id                uuid primary key default gen_random_uuid(),
  solicitud_id      uuid references solicitudes(id) on delete cascade not null,
  producto_id       uuid references productos(id),
  descripcion_libre text,
  cantidad          numeric(12,2) not null default 1,
  notas             text,
  created_at        timestamptz default now()
);

create index if not exists idx_solicitudes_cliente  on solicitudes(cliente_id);
create index if not exists idx_solicitudes_estado   on solicitudes(estado);
create index if not exists idx_solicitud_lineas_sol on solicitud_lineas(solicitud_id);

-- ── RLS ───────────────────────────────────────────────────────
alter table solicitudes       enable row level security;
alter table solicitud_lineas  enable row level security;

-- Lectura solo para usuarios autenticados de la app (Deisy/Marta).
-- El acceso público (formulario de solicitud) pasa siempre por
-- /api/solicitud/[token] usando el service_role, nunca directo.
create policy "read_auth" on solicitudes      for select using (auth.role() = 'authenticated');
create policy "read_auth" on solicitud_lineas for select using (auth.role() = 'authenticated');

create policy "service_all" on solicitudes      for all using (auth.role() = 'service_role');
create policy "service_all" on solicitud_lineas for all using (auth.role() = 'service_role');
