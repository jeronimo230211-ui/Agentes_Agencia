-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 006 — proformas.tipo_precio (mayorista/detallista).
-- Incremental, no destructiva — ver nota en migración 001.
--
-- El cotizador nunca aplicaba el margen real: leía cliente.margenes_categoria,
-- una columna del schema v1 que ya no existe (reemplazada por clientes.tipo
-- en el reset de schema_v2.sql), y por eso siempre caía a un 15% hardcodeado.
-- Los precios correctos ya existen por producto (productos.precio_mayorista /
-- precio_detallista, 183 filas pobladas) — falta que cada proforma sepa cuál
-- de los dos usar. Se elige por proforma (no fijo por cliente): el cotizador
-- lo trae por defecto de clientes.tipo pero se puede cambiar para esa
-- cotización puntual.
-- ══════════════════════════════════════════════════════════════

alter table proformas add column if not exists tipo_precio text not null default 'mayorista';

alter table proformas drop constraint if exists proformas_tipo_precio_check;
alter table proformas add constraint proformas_tipo_precio_check
  check (tipo_precio in ('mayorista', 'detallista'));
