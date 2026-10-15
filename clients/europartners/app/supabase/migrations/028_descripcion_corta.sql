-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 028 — Descripción corta de catálogo (ES/EN)
-- Incremental, no destructiva — ver nota en migración 001.
--
-- Pedido por Jero (2026-10-13): el catálogo público necesita una frase
-- corta tipo listado (~120 caracteres) para tarjetas de producto y
-- resultados de búsqueda, donde no cabe la descripcion_larga_es/en que ya
-- trae el pipeline de fichas técnicas (migración 014).
--
-- NO es un dato nuevo que el pipeline invente por separado: es una
-- condensación de la descripción larga YA APROBADA de cada producto. El
-- pipeline (clients/europartners/content-pipeline/) la genera junto con el
-- resto de la ficha, pero el campo vive aparte porque su consumidor en la
-- app es distinto (listado/tarjeta vs. página de detalle del producto).
--
-- Misma puerta de seguridad que 014: que esta columna tenga contenido no
-- significa que sea visible al público. Lo que decide qué se muestra en
-- el catálogo del cliente sigue siendo ficha_tecnica_estado ('aprobada') y
-- la lógica de la API/front — esta migración no cambia esa regla.
--
-- Nota de diseño: el límite de ~120 caracteres es una guía de contenido
-- para el pipeline, no una regla de integridad de datos -- no se agrega
-- `check (char_length(...) <= 120)` para no romper un valor legítimo que
-- se pase por un carácter o dos. Si en el futuro se vuelve una regla dura
-- de negocio, se agrega en una migración separada.
-- ══════════════════════════════════════════════════════════════

alter table productos add column if not exists descripcion_corta_es text;
alter table productos add column if not exists descripcion_corta_en text;
