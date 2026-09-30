-- ============================================================
-- LexBarbería — Idempotencia del webhook de WhatsApp
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- WhatsApp/Meta reintenta la entrega del webhook si no respondemos lo
-- bastante rápido, causando que el mismo mensaje se procese dos veces
-- (y el agente responda duplicado, o incluso agende dos veces). Esta
-- tabla registra qué IDs de mensaje ya se procesaron para descartar
-- los reintentos.
-- ============================================================

create table if not exists processed_webhook_messages (
  id           text primary key, -- wamid del mensaje de WhatsApp
  received_at  timestamptz not null default now()
);
