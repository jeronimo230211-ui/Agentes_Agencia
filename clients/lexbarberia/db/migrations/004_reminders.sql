-- ============================================================
-- LexBarbería — Recordatorio automático de citas
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Cada 15 min Supabase llama a /api/cron/reminders, que envía la
-- plantilla "recordatorio_cita" a las citas que empiezan dentro de
-- business.reminder_hours_before[1] horas (3 por defecto). El plan
-- gratis de Vercel solo permite crons diarios, por eso el reloj vive aquí.
--
-- ANTES DE CORRER: reemplazar __CRON_SECRET__ por el mismo valor de la
-- variable CRON_SECRET en Vercel. No commitear el valor real.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotente: si el job ya existe, se reemplaza.
select cron.unschedule('lexbarberia-recordatorios')
where exists (select 1 from cron.job where jobname = 'lexbarberia-recordatorios');

select cron.schedule(
  'lexbarberia-recordatorios',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://lexbarberia.vercel.app/api/cron/reminders',
    headers := '{"Authorization": "Bearer __CRON_SECRET__", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- Recordatorio 3h antes (la ventana de cancelación es 2h: el cliente alcanza a avisar).
update business set reminder_hours_before = '{3}' where slug = 'lexbarberia';
