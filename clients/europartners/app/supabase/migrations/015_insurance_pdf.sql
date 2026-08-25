-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 015 — Insurance term para el PDF de proforma
-- Incremental, no destructiva — ver nota en migración 001.
--
-- Pedido por Deisy (2026-08-24): el PDF debe mostrar Order No,
-- Incoterm, Freight e Insurance. Order No ya existe como
-- proformas.numero_cliente (sin usar hasta ahora); Incoterm y Freight
-- se resuelven del incoterm ya existente. Insurance es el único campo
-- nuevo — término de quién cubre el seguro de la mercancía.
-- ══════════════════════════════════════════════════════════════

alter table proformas
  add column if not exists insurance text not null default 'COLLECT';

alter table proformas
  add constraint proformas_insurance_check check (insurance in ('COLLECT', 'PREPAID'));
