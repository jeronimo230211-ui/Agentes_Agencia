-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 013 — Revisión de Marta opcional por proforma
-- Incremental, no destructiva — ver nota en migración 001.
--
-- Pedido por Jero (2026-08-19), a raíz de feedback de Deisy: Marta no
-- puede aprobar constantemente cada proforma que Deisy arma, eso vuelve
-- el proceso lento. Decisión: las proformas nuevas NO requieren revisión
-- de Marta por defecto — Deisy (u operaciones en general) puede aprobar
-- y enviar al cliente ella misma. Deisy o Marta pueden marcar una
-- proforma puntual como "sí requiere revisión" cuando el caso lo
-- amerite, y esa sigue el flujo de siempre (enviar a revisión → cola de
-- Marta en /aprobacion).
-- ══════════════════════════════════════════════════════════════

alter table proformas add column if not exists requiere_revision boolean not null default false;
