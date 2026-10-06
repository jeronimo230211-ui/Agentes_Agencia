-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 027 — Infraestructura para backups automáticos
-- Incremental, no destructiva — ver nota en migración 001.
--
-- Urgente tras el incidente real del 2026-10-05 (proforma 3-0253 perdió
-- sus 5 líneas en un guardado — ver fix en el mismo commit que esta
-- migración). Hoy la única fuente de verdad es Supabase, sin ninguna
-- copia independiente automatizada. Esta migración solo prepara el lado
-- de base de datos para que /api/cron/backup (cron de Vercel) pueda
-- hacer un snapshot JSON de cada tabla y subirlo a un bucket privado.
-- ══════════════════════════════════════════════════════════════

-- ── Bucket privado para los backups ───────────────────────────────
-- NO reusar el bucket "documentos" (es público, sirve PDFs a clientes) ni
-- "productos" (público, fotos de catálogo) — un backup tiene datos de
-- TODAS las tablas (clientes, precios, proformas) y no debe ser accesible
-- por URL pública bajo ninguna circunstancia.
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

-- Solo el cliente admin (service_role, el único que usa el cron) puede
-- leer o escribir en este bucket — mismo patrón que el resto de tablas
-- sensibles de este esquema (ver policies "service_all" más abajo en
-- schema_v2.sql).
drop policy if exists "service_all_backups" on storage.objects;
create policy "service_all_backups" on storage.objects
  for all
  using (bucket_id = 'backups' and auth.role() = 'service_role')
  with check (bucket_id = 'backups' and auth.role() = 'service_role');

-- ── Función para listar las tablas a respaldar ────────────────────
-- El cron de backup llama esto por RPC en vez de traer una lista fija de
-- nombres de tabla hardcodeada en el código — así una tabla nueva que se
-- agregue en una migración futura queda respaldada automáticamente, sin
-- tener que acordarse de actualizar el cron cada vez.
create or replace function public.listar_tablas_backup()
returns table(tabla text)
language sql
security definer
set search_path = public
as $$
  select tablename::text
  from pg_tables
  where schemaname = 'public'
  order by tablename;
$$;
