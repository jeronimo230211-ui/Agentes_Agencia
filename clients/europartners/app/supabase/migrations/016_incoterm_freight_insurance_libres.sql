-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 016 — Incoterm, Freight e Insurance editables libremente
-- Incremental, no destructiva — ver nota en migración 001.
--
-- Pedido por Jero (2026-08-27): en el cotizador, Order No/Incoterm/
-- Freight/Insurance deben poder elegirse de una lista O digitarse
-- libre. Freight hasta ahora solo se mostraba en el PDF como copia
-- fija de incoterm — pasa a ser un campo propio de la proforma
-- (nullable: si queda vacío, la app sigue mostrando/usando el
-- incoterm como antes). Insurance tenía un check que solo permitía
-- COLLECT/PREPAID — se quita para permitir texto libre igual que
-- incoterm (que nunca tuvo check a nivel de proformas).
-- ══════════════════════════════════════════════════════════════

alter table proformas
  add column if not exists freight text;

alter table proformas
  drop constraint if exists proformas_insurance_check;
