-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 003 — Columnas del catálogo FINAL (183 productos) +
-- indicador de historial (hoja "Cruce Catalogo vs Historial").
-- Incremental, no destructiva — ver nota en migración 001.
--
-- Alcance decidido con Jero (2026-07-20): solo el INDICADOR de
-- historial (Sí/No + stats agregadas), no la re-migración completa
-- de proformas/proforma_lineas/historial_precios (esas 3 tablas
-- siguen vacías desde el reset de julio — queda como pendiente aparte).
-- ══════════════════════════════════════════════════════════════

-- ── Columnas de precio/dimensión que trae el Excel FINAL y que
--    productos no tenía (importar-catalogo.js viejo las descartaba) ──
alter table productos
  add column if not exists color_variante            text,
  add column if not exists moq                       integer,
  add column if not exists cbm_unitario               numeric(10,4),
  add column if not exists precio_exw_rmb_bigbasin    numeric(12,4),
  add column if not exists precio_fob_full_container  numeric(12,4),
  add column if not exists margen_mayorista_pct       numeric(6,4),
  add column if not exists precio_mayorista           numeric(12,4),
  add column if not exists margen_detallista_pct      numeric(6,4),
  add column if not exists precio_detallista          numeric(12,4),
  add column if not exists tiene_foto                 boolean default false,
  add column if not exists archivo_origen             text;

-- ── Indicador de historial (leído de la hoja "Cruce Catalogo vs
--    Historial" de Europartners_BD_Proformas_y_Precios.xlsx) ──
alter table productos
  add column if not exists tiene_historial                      boolean not null default false,
  add column if not exists categoria_vieja                      text,
  add column if not exists veces_vendido                        integer,
  add column if not exists clientes_compradores                 text,
  add column if not exists fecha_primera_venta                  date,
  add column if not exists fecha_ultima_venta                   date,
  add column if not exists precio_costo_historico_min           numeric(12,4),
  add column if not exists precio_cliente_historico_min          numeric(12,4),
  add column if not exists precio_cliente_historico_max          numeric(12,4),
  add column if not exists precio_cliente_historico_promedio     numeric(12,4),
  add column if not exists precio_cliente_historico_ultimo       numeric(12,4),
  add column if not exists margen_historico_pct_ultimo           numeric(6,4),
  add column if not exists variacion_pct_mayorista_vs_historico  numeric(6,4),
  add column if not exists variacion_pct_detallista_vs_historico numeric(6,4),
  add column if not exists historial_actualizado_at              timestamptz;

create index if not exists idx_productos_tiene_historial on productos(tiene_historial);
