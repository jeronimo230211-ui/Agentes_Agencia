-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 019 — Anulación de factura
-- Incremental, no destructiva — ver nota en migración 001.
--
-- Pedido por Jero (2026-08-30), dentro de la construcción de /facturador:
-- una proforma que ya llegó a estado 'facturada' (el cliente la aprobó,
-- se le mandó el invoice) no tenía ningún camino de vuelta si Deisy
-- cometía un error. Se agrega el estado 'anulada' + el motivo, mismo
-- patrón que 'rechazada'/motivo_rechazo.
-- ══════════════════════════════════════════════════════════════

alter table proformas
  drop constraint if exists proformas_estado_check;

alter table proformas
  add constraint proformas_estado_check
  check (estado in ('borrador', 'en_revision', 'aprobada', 'rechazada', 'enviada', 'facturada', 'cambios_solicitados', 'anulada'));

alter table proformas
  add column if not exists motivo_anulacion text;
