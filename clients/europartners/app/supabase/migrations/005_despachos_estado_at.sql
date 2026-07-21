-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 005 — despachos.estado_at (tiempo en el estado actual).
-- Incremental, no destructiva — ver nota en migración 001.
--
-- despachos.updated_at se pisa en CUALQUIER edición (naviera, fechas,
-- notas, etc. — ver app/api/despachos/[id]/route.ts), no solo cuando
-- cambia el estado, así que no sirve para medir "tiempo pendiente en
-- el estado actual" para las alertas de Marta. estado_at solo se
-- actualiza cuando el campo estado realmente cambia (ver companion
-- change en despachos/[id]/route.ts).
-- ══════════════════════════════════════════════════════════════

alter table despachos add column if not exists estado_at timestamptz;

update despachos set estado_at = coalesce(estado_at, updated_at, created_at)
  where estado_at is null;

alter table despachos alter column estado_at set default now();
