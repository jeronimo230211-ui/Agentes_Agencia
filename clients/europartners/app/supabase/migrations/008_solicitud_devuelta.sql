-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 008 — Devolver solicitud al cliente con observación
-- Incremental, no destructiva.
-- ══════════════════════════════════════════════════════════════

-- ── Ampliar estados de solicitudes ────────────────────────────
alter table solicitudes drop constraint if exists solicitudes_estado_check;
alter table solicitudes add constraint solicitudes_estado_check
  check (estado in ('pendiente', 'revisada', 'convertida', 'descartada', 'devuelta'));

-- ── Columnas para devolución ───────────────────────────────────
alter table solicitudes add column if not exists motivo_devolucion text;
alter table solicitudes add column if not exists token_edicion text unique;
alter table solicitudes add column if not exists veces_devuelta integer not null default 0;

-- ── Historial de devoluciones/reenvíos ─────────────────────────
create table if not exists solicitud_eventos (
  id           uuid primary key default gen_random_uuid(),
  solicitud_id uuid references solicitudes(id) on delete cascade not null,
  usuario_id   uuid references usuarios(id),
  tipo         text not null check (tipo in ('devuelta', 'reenviada')),
  comentario   text,
  created_at   timestamptz default now()
);

create index if not exists idx_solicitud_eventos_sol on solicitud_eventos(solicitud_id);

alter table solicitud_eventos enable row level security;

create policy "read_auth" on solicitud_eventos for select using (auth.role() = 'authenticated');
create policy "service_all" on solicitud_eventos for all using (auth.role() = 'service_role');
