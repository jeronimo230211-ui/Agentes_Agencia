-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 018 — Incoterm/Freight/Insurance por defecto, por cliente
-- Incremental, no destructiva — ver nota en migración 001.
--
-- Pedido por Deisy (operaciones, vía Jero, 2026-08-30): que Incoterm/
-- Freight/Insurance (editables por proforma desde la migración 016) se
-- puedan guardar como default de cada cliente, para no llenarlos a
-- mano en cada proforma nueva, y que ese default se pueda editar.
--
-- clientes.incoterm ya existía desde el schema base y ya se heredaba
-- al crear una proforma (mismo mecanismo que clientes.tipo ->
-- proformas.tipo_precio) — solo faltaba Freight/Insurance y una
-- pantalla para editarlo. Se renombra a incoterm_default para quedar
-- simétrico con los 2 campos nuevos, y se le quita el check
-- FOB/CFR/CIF para que sea texto libre igual que a nivel de proforma.
-- ══════════════════════════════════════════════════════════════

alter table clientes
  rename column incoterm to incoterm_default;

alter table clientes
  drop constraint if exists clientes_incoterm_check;

alter table clientes
  add column if not exists freight_default text;

alter table clientes
  add column if not exists insurance_default text;
