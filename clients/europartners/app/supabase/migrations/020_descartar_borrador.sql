-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 020 — Descartar borrador (soft-delete)
-- Incremental, no destructiva — ver nota en migración 001.
--
-- Investigando el salto 3-0244 → 3-0246 (Jero, 2026-09-02): el número se
-- asigna con una secuencia (proforma_numero_seq) que se consume en el
-- INSERT y nunca retrocede. El DELETE físico de /api/proformas/[id]
-- (solo permitido sobre 'borrador') borraba la fila para siempre y además
-- se llevaba en cascada su historial en proforma_eventos — no quedaba
-- ningún rastro de qué pasó con el número faltante.
--
-- Se agrega el estado 'descartada' para que borrar un borrador sea un
-- cambio de estado (con evento registrado) en vez de un DELETE real.
-- ══════════════════════════════════════════════════════════════

alter table proformas
  drop constraint if exists proformas_estado_check;

alter table proformas
  add constraint proformas_estado_check
  check (estado in ('borrador', 'en_revision', 'aprobada', 'rechazada', 'enviada', 'facturada', 'cambios_solicitados', 'anulada', 'descartada'));
