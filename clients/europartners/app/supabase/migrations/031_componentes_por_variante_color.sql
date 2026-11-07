-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 031 — Activar `producto_componentes` por VARIANTE de color
-- Incremental, no destructiva — ver nota en migración 001.
--
-- ── Contexto (investigado antes de esta migración) ────────────────
-- Hardware & Lumber (HL) cotiza inodoros como 3 líneas separadas
-- (Bowl, Tank, Seat Cover) en vez de una sola línea del set completo —
-- 93 de 94 casos reales mapeados, 18 códigos, 33 proformas. La tabla
-- `producto_componentes` ya existía en schema_v2.sql (FK a
-- `producto_id`) y ya estaba parcialmente conectada en el API
-- (app/api/productos/route.ts la anida bajo cada producto;
-- app/api/proformas/[id]/route.ts la resuelve en cada línea;
-- `proforma_lineas.componente_id` ya existe y el cotizador ya lo
-- reenvía al guardar) — pero nunca tuvo UI y está en 0 filas.
--
-- El dato nuevo que motiva esta migración: el precio real de cada
-- parte (Bowl/Tank/Seatcover) varía por COLOR del set (ej. HK0426
-- blanco vs. hueso suman montos distintos y consistentes por color).
-- `producto_componentes` tal como estaba (FK directo a `producto_id`)
-- no puede representar eso: un componente colgado del producto
-- genérico no tiene dónde guardar "este precio es para el color X".
--
-- ── Qué hace ──────────────────────────────────────────────────────
-- 1. Agrega `producto_componentes.variante_id` (nullable) — el
--    componente ahora puede colgar de una VARIANTE de color
--    específica (`producto_variantes`) en vez de (o además de) colgar
--    directamente del producto genérico.
-- 2. Agrega la FK compuesta (variante_id, producto_id) →
--    producto_variantes(id, producto_id): si se informa variante_id,
--    Postgres obliga a que esa variante sea realmente del mismo
--    producto que dice `producto_componentes.producto_id` — evita que
--    una carga masiva enganche por error un componente de HK0426 a una
--    variante de HK0427. Si variante_id es null, la FK compuesta no
--    aplica (semántica NULL de Postgres) y solo queda la FK simple a
--    `producto_id` que ya existía: no rompe nada de lo ya conectado.
-- 3. Agrega dos índices únicos parciales para que no se pueda repetir
--    el mismo nombre de componente ("Tank" dos veces) ni dentro de la
--    misma variante ni dentro del mismo producto cuando no hay
--    variante — ver regla de integridad #7 del arquitecto (constraints
--    en la BD, no solo en el loader).
--
-- ── Decisión de diseño: NO se inventa columna de color nueva ──────
-- `producto_variantes.variante` (text) ya es genérico para cualquier
-- variante del producto — para este caso de uso se usa para el color
-- ("Blanco", "Hueso", etc.), con su propio `precio_fob_usd` (no hereda
-- del producto padre: ya lo soporta el esquema actual, sin cambios).
-- NO confundir con `productos.color_variante` (migración 003): esa es
-- una etiqueta plana para SKUs de UN solo color en el catálogo normal.
-- Cuando un código SÍ tiene varios colores con precio propio (el caso
-- HL), ese código vive en `productos` sin depender de
-- `color_variante`, y cada color es una fila en `producto_variantes`.
--
-- Relación final: producto_variantes (por color) → producto_componentes
-- (por parte, con su propio precio_fob_usd). La suma de los
-- componentes de una variante debería aproximarse al precio_fob_usd
-- de esa variante — esto es una validación de calidad de datos para
-- quien cargue los 47 códigos faltantes (data-pipeline-engineer),
-- NO un constraint de BD: los componentes reales no siempre suman
-- exacto por redondeo, y no todo producto con variantes de color
-- necesariamente se vende partido en componentes.
--
-- ── Alcance por cliente (confirmado, sin cambios) ──────────────────
-- `clientes.modo_pricing = 'componente'` (hoy solo HL, slug 'hl') ya
-- es la señal correcta para que el frontend muestre la opción de
-- "dividir en partes" en el cotizador. No se agrega ningún campo
-- nuevo de alcance — es exactamente el mecanismo que ya existe.
--
-- ── Impacto en la app ──────────────────────────────────────────────
-- Ninguno sobre lo que ya funciona: no se renombra ni se quita ninguna
-- columna ni tabla. `producto_componentes` sigue teniendo 0 filas
-- hasta que data-pipeline-engineer cargue los 47 códigos + sus
-- variantes/componentes. El API ya selecciona `producto_componentes(*)`
-- completo (select *), así que `variante_id` aparecerá solo cuando
-- haya filas reales — no requiere tocar las queries existentes.
-- SÍ falta construir en el cotizador: selector de color (variante) y
-- opción "dividir en partes" cuando `clientes.modo_pricing = 'componente'`
-- (pendiente de ui-ux-designer + agency-developer, fuera de esta
-- migración).
--
-- ── Cómo verificar (Jerónimo, en el SQL Editor de Supabase) ───────
-- 1. Abre el SQL Editor del proyecto Europartners.
-- 2. Pega este archivo completo (031_componentes_por_variante_color.sql).
-- 3. Run.
-- 4. Corre estas queries de verificación, en orden (usan un producto
--    real existente, no modifican catálogo real — todo se borra en D):
--
--    -- A) crear una variante de color de prueba sobre un producto real:
--    with p as (select id from productos order by created_at desc limit 1)
--    insert into producto_variantes (producto_id, variante, precio_fob_usd)
--    select id, 'TEST-Blanco-031', 100.00 from p
--    returning id, producto_id;
--    -- guarda el id y producto_id que devuelve para los pasos siguientes.
--
--    -- B) colgar un componente de esa variante — debe funcionar:
--    insert into producto_componentes (producto_id, variante_id, componente, precio_fob_usd)
--    values ('<producto_id de A>', '<id de A>', 'TEST-Tank-031', 40.00)
--    returning id;
--    -- esperado: inserta sin error.
--
--    -- C) intentar colgar un componente con variante_id de A pero un
--    --    producto_id DISTINTO — debe FALLAR con error 23503:
--    insert into producto_componentes (producto_id, variante_id, componente, precio_fob_usd)
--    select id, '<id de A>', 'TEST-Bowl-031', 60.00
--    from productos where id <> '<producto_id de A>' limit 1;
--    -- esperado: error "insert or update on table producto_componentes
--    -- violates foreign key constraint fk_componentes_variante_producto".
--
--    -- D) limpiar los datos de prueba:
--    delete from producto_componentes where componente like 'TEST-%-031';
--    delete from producto_variantes where variante like 'TEST-%-031';
-- ══════════════════════════════════════════════════════════════

-- ── 1. Soporte para la FK compuesta: (id, producto_id) único ──────
-- `id` ya es PK (único por sí solo); esta unique adicional permite que
-- otra tabla referencie el PAR (id, producto_id) con una FK compuesta.
-- Postgres no soporta "ADD CONSTRAINT IF NOT EXISTS" — se dropea antes
-- (si no existe, el drop no hace nada) para que el archivo se pueda
-- volver a correr sin error, mismo patrón de 024/026_visibilidad_catalogo.sql.
alter table producto_variantes
  drop constraint if exists uq_variantes_id_producto;
alter table producto_variantes
  add constraint uq_variantes_id_producto unique (id, producto_id);

-- ── 2. Nueva columna: a qué variante de color pertenece el componente ──
alter table producto_componentes
  add column if not exists variante_id uuid references producto_variantes(id) on delete cascade;

-- ── 3. FK compuesta: si hay variante_id, debe ser del mismo producto ──
-- Semántica NULL de Postgres: si variante_id es null, esta constraint
-- no se evalúa (MATCH SIMPLE, el default) — no afecta las filas que
-- cuelgan directo de producto_id sin variante.
alter table producto_componentes
  drop constraint if exists fk_componentes_variante_producto;
alter table producto_componentes
  add constraint fk_componentes_variante_producto
  foreign key (variante_id, producto_id)
  references producto_variantes (id, producto_id);

-- ── 4. No repetir el mismo componente dos veces en el mismo lugar ──
create unique index if not exists idx_componentes_unico_por_variante
  on producto_componentes (variante_id, componente)
  where variante_id is not null;

create unique index if not exists idx_componentes_unico_por_producto
  on producto_componentes (producto_id, componente)
  where variante_id is null;

-- Nota: no se agrega un índice aparte por `variante_id` — el índice
-- único parcial de arriba (variante_id, componente) ya cubre el
-- patrón de consulta "componentes de esta variante" sin duplicar índice.

-- RLS: sin cambios — producto_componentes ya tiene "read_auth" +
-- "service_all" desde schema_v2.sql y cubren la tabla completa,
-- incluida la columna nueva.
-- ══════════════════════════════════════════════════════════════
