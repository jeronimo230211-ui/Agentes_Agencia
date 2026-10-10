-- ============================================================
-- MIGRACIÓN 006 — Activar RLS en todas las tablas (cerrar acceso anon)
-- Incremental, no destructiva. No cambia datos.
--
-- Por qué: en 001 el RLS quedó comentado ("activar cuando haya auth").
-- Con RLS apagado, cualquiera que tenga la anon key del proyecto
-- (NEXT_PUBLIC_SUPABASE_ANON_KEY, pensada para ser pública) puede leer
-- y escribir TODAS las tablas vía /rest/v1: teléfonos de clientes,
-- citas, conversaciones y tokens de Google/WhatsApp en `business`.
-- Hoy la anon key no se usa en el código del navegador, pero eso es
-- una protección por omisión, no por diseño.
--
-- Impacto en la app: ninguno. Todas las API routes usan
-- SUPABASE_SERVICE_KEY (src/lib/supabase.ts), que tiene BYPASSRLS.
-- pg_cron llama a /api/cron/reminders por HTTP, no lee tablas como anon.
--
-- Sin policies a propósito: anon y authenticated quedan sin acceso.
-- Si algún día el dashboard usa Supabase Auth, se agregan policies.
--
-- Verificación después de correrla:
--   1. Security Advisor de Supabase: sin "RLS disabled" en public.
--   2. Mandar un WhatsApp de prueba al bot y agendar desde el
--      dashboard: debe seguir funcionando igual.
-- ============================================================

alter table business                   enable row level security;
alter table barbers                    enable row level security;
alter table services                   enable row level security;
alter table business_hours             enable row level security;
alter table schedule_exceptions        enable row level security;
alter table clients                    enable row level security;
alter table recurring_bookings         enable row level security;
alter table appointments               enable row level security;
alter table notifications_log          enable row level security;
alter table broadcasts                 enable row level security;
alter table conversations              enable row level security;
alter table waitlist                   enable row level security;
alter table processed_webhook_messages enable row level security;
alter table inbound_messages           enable row level security;
