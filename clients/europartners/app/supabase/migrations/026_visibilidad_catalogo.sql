-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 026 — Apagar referencias y categorías del catálogo
-- Incremental, no destructiva — ver nota en migración 001.
--
-- Pedido de Marta (2026-09-30): poder ocultar productos puntuales o
-- categorías completas del catálogo (admin + público) sin borrarlos,
-- para reactivarlos más adelante.
--
-- Decisión explícita de Jero: NO reusar `productos.estado = 'descontinuado'`
-- para esto — ese valor ya significa "el producto dejó de fabricarse"
-- (un hecho de negocio permanente), mientras que "apagar" es ocultar
-- temporalmente de la vista sin implicar que el producto murió. Se agrega
-- un valor nuevo, 'oculto', en vez de mezclar ambos significados.
-- ══════════════════════════════════════════════════════════════

-- ── `productos.estado` — agregar 'oculto' al check constraint ───
-- Mismo patrón que 024_pago_flete_despacho.sql: Postgres no tiene "alter
-- check constraint", hay que borrar y recrear. Se usa el nombre por
-- default que le puso Postgres al constraint original de schema_v2.sql
-- (`productos_estado_check`, generado a partir de `check (estado in (...))`
-- sin nombre explícito).
alter table productos drop constraint if exists productos_estado_check;
alter table productos add constraint productos_estado_check
  check (estado in ('activo', 'descontinuado', 'pendiente', 'oculto'));

-- ── `categorias_producto.activo` ──────────────────────────────────
-- No existía ningún campo de estado a nivel de categoría. Se usa un
-- booleano (no un text+check como en productos.estado) porque es el
-- patrón que ya usa el resto del esquema para "encendido/apagado" sin
-- matices intermedios (ver clientes.activo, producto_variantes.activo,
-- parametros_precio.activo, sku_clientes.activo en schema_v2.sql).
alter table categorias_producto
  add column if not exists activo boolean not null default true;
