-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 014 — Descripciones profesionales + ficha técnica por producto
-- Incremental, no destructiva — ver nota en migración 001.
--
-- Pedido por Jero (2026-08-19): mejorar la calidad de las descripciones del
-- catálogo (hoy suelen ser texto crudo del proveedor chino) y agregar una
-- ficha técnica estructurada, generadas por un pipeline de agentes que usa
-- SOLO la data propia de Europartners como fuente de hechos (nunca inventa
-- ni copia specs de sitios de referencia — esos solo informan formato/tono).
--
-- ficha_tecnica_estado es la puerta de seguridad: nada generado se muestra
-- en el catálogo público del cliente hasta que alguien lo aprueba a mano
-- desde el catálogo interno (mismo patrón que requiere_revision, migración
-- 013, para no exponer contenido sin revisión humana).
-- ══════════════════════════════════════════════════════════════

alter table productos add column if not exists descripcion_larga_es text;
alter table productos add column if not exists descripcion_larga_en text;
alter table productos add column if not exists ficha_tecnica jsonb;
alter table productos add column if not exists ficha_tecnica_estado text
  not null default 'borrador' check (ficha_tecnica_estado in ('borrador','aprobada'));
alter table productos add column if not exists ficha_tecnica_generada_at timestamptz;
alter table productos add column if not exists ficha_tecnica_revisada_por uuid references usuarios(id);
