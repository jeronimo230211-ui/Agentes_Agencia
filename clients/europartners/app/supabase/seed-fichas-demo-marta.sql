-- ══════════════════════════════════════════════════════════════
-- SEED DE DEMO — 3 fichas técnicas para mostrarle a Marta (diseñadora)
-- NO es una migración de esquema (por eso vive fuera de supabase/migrations/,
-- es contenido, no estructura). Requiere haber corrido primero
-- 028_descripcion_corta.sql (agrega descripcion_corta_es/en).
--
-- Pedido por Jero (2026-10-13). Fuente de los 3 productos: el pipeline de
-- fichas técnicas (clients/europartners/content-pipeline/output/patron/),
-- usado tal cual porque no pude confirmar en vivo contra producción si
-- estas filas ya tenían algo cargado -- el sandbox bloqueó la consulta de
-- solo lectura (regla de la agencia: nunca tocamos producción directo,
-- ni siquiera para leer, desde aquí). Si el pipeline ya había cargado
-- contenido distinto para estos 3 productos, este script lo reemplaza por
-- el de los JSON de salida del pipeline (que es la fuente de verdad del
-- contenido generado).
--
-- Elegidos a propósito para mostrar los 2 estados reales del pipeline:
--   • A065 y KM-459-KC-001-30X80 -> aprobado_ia: true en el pipeline ->
--     quedan en ficha_tecnica_estado = 'aprobada' (visibles en catálogo).
--   • HK0426 BONE                -> aprobado_ia: false en el pipeline ->
--     se queda en 'borrador' A PROPÓSITO. La ficha fuente (TECHNICAL SHEET
--     - HK0426.docx) lista las 3 dimensiones del producto sin rotular cuál
--     es largo/ancho/alto; el pipeline infirió el orden por convención de
--     plantilla pero no está confirmado en el documento. Por eso no se
--     aprueba aquí -- es el ejemplo real de "el pipeline prefiere dejar
--     algo en borrador antes que inventar".
--
-- OJO con el codigo real: en la tabla productos el código de este producto
-- es "HK0426 BONE" (con ESPACIO), no "HK0426-BONE". El filtro de abajo usa
-- el id (uuid) que el pipeline ya tiene vinculado como identificador
-- principal -- más seguro que el codigo -- y el codigo como verificación
-- secundaria exacta.
--
-- Seguridad del script: cada UPDATE va en un bloque PL/pgSQL que cuenta
-- las filas afectadas y lanza excepción si no es exactamente 1 (evita que
-- un id o codigo que ya no calce actualice 0 filas en silencio). Todo el
-- script es una sola transacción: si un producto falla, no se aplica
-- ninguno (patrón de la regla #9 del arquitecto -- nada a medias).
--
-- CÓMO VERIFICAR ANTES DE CORRER (recomendado, opcional):
--   select id, codigo, ficha_tecnica_estado, descripcion_larga_es is not null as tiene_larga,
--          ficha_tecnica is not null as tiene_ficha
--   from productos
--   where id in (
--     '6efbccfc-b183-4f25-b2ac-51509e4eeaa2', -- A065
--     'e60b97e6-bb85-40e3-9b6a-394ad9f5e41f', -- HK0426 BONE
--     '00f47c69-d33e-4dca-bbc5-6ce2b993bafd'  -- KM-459-KC-001-30X80
--   );
-- Si alguna fila ya tiene contenido distinto al de este script, este
-- UPDATE lo reemplaza por el del pipeline (que es el contenido "canónico"
-- para estos 3 códigos).
-- ══════════════════════════════════════════════════════════════

begin;

-- ── A065 — Wash Down Toilet (aprobado_ia: true -> 'aprobada') ─────────
do $$
declare
  filas int;
begin
  update productos set
    descripcion_larga_es = 'Inodoro de una pieza, sistema wash-down, con P-trap de 180 mm y descarga dual (4 L / 6 L). Incluye kit de válvulas de descarga y tapa de asiento en PP con cierre lento. Dimensiones del producto: 670 x 360 x 750 mm. Empacado en cartón de 5 capas. Color: blanco.',
    descripcion_larga_en = 'One-piece wash-down toilet with 180 mm P-trap and dual flush system (4 L / 6 L). Includes flush fitting kit and a PP slow-closing seat cover. Product dimensions: 670 x 360 x 750 mm. Packed in 5-layer brown carton. Color: White.',
    descripcion_corta_es = 'Inodoro de una pieza, wash-down, con descarga dual 4 L / 6 L, en blanco.',
    descripcion_corta_en = 'One-piece wash-down toilet with dual 4 L / 6 L flush, in White.',
    ficha_tecnica = '{
      "campos": [
        { "label": "Tipo de instalación", "valor": "Una pieza (one-piece)" },
        { "label": "Sistema de descarga", "valor": "Wash down, P-trap 180 mm" },
        { "label": "Volumen de descarga", "valor": "4 L / 6 L (descarga dual)" },
        { "label": "Dimensiones del producto", "valor": "670 x 360 x 750 mm (largo x ancho x alto)" },
        { "label": "Accesorios incluidos", "valor": "Kit de válvulas de descarga, tapa de asiento en PP con cierre lento" },
        { "label": "Empaque", "valor": "Cartón de 5 capas" },
        { "label": "Color", "valor": "Blanco" }
      ]
    }'::jsonb,
    ficha_tecnica_estado = 'aprobada',
    ficha_tecnica_generada_at = now(),
    -- ficha_tecnica_revisada_por: se deja NULL a propósito -- este script
    -- es un seed por SQL directo, no pasó por el botón "Aprobar" de la app
    -- (app/api/productos/[id]/aprobar-ficha/route.ts), que es quien
    -- registra el usuario real que aprobó. Si Jero quiere que se vea como
    -- aprobado por alguien específico, reemplazar NULL abajo por el uuid
    -- de ese usuario (select id from usuarios where email = '...').
    ficha_tecnica_revisada_por = null,
    updated_at = now()
  where id = '6efbccfc-b183-4f25-b2ac-51509e4eeaa2'
    and codigo = 'A065';

  get diagnostics filas = row_count;
  if filas <> 1 then
    raise exception 'A065: se esperaba actualizar 1 fila y se actualizaron %. Verifica id/codigo en productos antes de reintentar.', filas;
  end if;
end $$;

-- ── KM-459-KC-001-30X80 — PVC Door (aprobado_ia: true -> 'aprobada') ──
do $$
declare
  filas int;
begin
  update productos set
    descripcion_larga_es = 'Puerta interior modelo KM-459, hoja de MDF con acabado en PVC. Acabado: KC-001 White Ash. Tamaño estándar 30" x 80" (762 x 2032 mm). Se vende como hoja de puerta; el marco se cotiza por separado.',
    descripcion_larga_en = 'Interior door, model KM-459, MDF core door leaf with PVC finish. Finish: KC-001 White Ash. Standard size 30" x 80" (762 x 2032 mm). Sold as door leaf only; frame quoted separately.',
    descripcion_corta_es = 'Puerta interior KM-459, hoja de MDF con acabado PVC White Ash, 30" x 80".',
    descripcion_corta_en = 'Interior door KM-459, MDF door leaf with PVC White Ash finish, 30" x 80".',
    ficha_tecnica = '{
      "campos": [
        { "label": "Modelo / diseño", "valor": "KM-459" },
        { "label": "Material", "valor": "Hoja de MDF con acabado en PVC (MDF PVC door leaf)" },
        { "label": "Acabado / color", "valor": "KC-001 White Ash" },
        { "label": "Tamaño", "valor": "30\" x 80\" (762 x 2032 mm)" },
        { "label": "Incluye", "valor": "Hoja de puerta únicamente" }
      ]
    }'::jsonb,
    ficha_tecnica_estado = 'aprobada',
    ficha_tecnica_generada_at = now(),
    ficha_tecnica_revisada_por = null, -- ver nota de A065 arriba
    updated_at = now()
  where id = '00f47c69-d33e-4dca-bbc5-6ce2b993bafd'
    and codigo = 'KM-459-KC-001-30X80';

  get diagnostics filas = row_count;
  if filas <> 1 then
    raise exception 'KM-459-KC-001-30X80: se esperaba actualizar 1 fila y se actualizaron %. Verifica id/codigo en productos antes de reintentar.', filas;
  end if;
end $$;

-- ── HK0426 BONE — Ivory Sinks/Toilets (aprobado_ia: false -> queda en
--    'borrador' A PROPÓSITO, no se toca ficha_tecnica_estado) ──────────
do $$
declare
  filas int;
begin
  update productos set
    descripcion_larga_es = 'Inodoro de dos piezas, alargado, de altura ADA (confort), con sistema de descarga de 4.8 L. Incluye tanque con sistema de válvulas, tapa con cierre suave, manguera flexible de suministro y kit de sello de cera. Dimensiones del producto: 750 x 417 x 780 mm. Peso neto: 42 kg. Disponible en blanco y bone.',
    descripcion_larga_en = 'Two-piece elongated toilet with ADA (comfort) height and a 4.8 L flush system. Includes tank with fitting system, soft-closing seat cover, flexible supply pipe and wax seal kit. Product dimensions: 750 x 417 x 780 mm. Net weight: 42 kg. Available in White and Bone.',
    descripcion_corta_es = 'Inodoro de dos piezas, alargado, altura ADA, descarga 4.8 L, en blanco y bone.',
    descripcion_corta_en = 'Two-piece elongated toilet, ADA height, 4.8 L flush, in White and Bone.',
    ficha_tecnica = '{
      "campos": [
        { "label": "Tipo de instalación", "valor": "Dos piezas (two-piece)" },
        { "label": "Forma", "valor": "Alargada (elongated)" },
        { "label": "Altura", "valor": "ADA / confort" },
        { "label": "Descarga", "valor": "4.8 L (descarga única)" },
        { "label": "Dimensiones del producto", "valor": "750 x 417 x 780 mm (largo x ancho x alto)" },
        { "label": "Peso neto", "valor": "42 kg" },
        { "label": "Accesorios incluidos", "valor": "Tanque con sistema de válvulas, tapa con cierre suave, manguera flexible de suministro, kit de sello de cera" },
        { "label": "Color", "valor": "Blanco / Bone" }
      ]
    }'::jsonb,
    ficha_tecnica_generada_at = now()
    -- ficha_tecnica_estado NO se toca: se queda en el default 'borrador'.
    -- Es intencional -- ver nota larga al inicio del archivo sobre el
    -- orden de dimensiones sin confirmar en TECHNICAL SHEET - HK0426.docx.
  where id = 'e60b97e6-bb85-40e3-9b6a-394ad9f5e41f'
    and codigo = 'HK0426 BONE';

  get diagnostics filas = row_count;
  if filas <> 1 then
    raise exception 'HK0426 BONE: se esperaba actualizar 1 fila y se actualizaron %. Revisa si el codigo real tiene espacio, guion u otra variante antes de reintentar.', filas;
  end if;
end $$;

commit;

-- Verificación rápida después de correr (debe mostrar 2 'aprobada' y 1
-- 'borrador', los 3 con descripcion_corta_es/en llenas):
--   select codigo, ficha_tecnica_estado, descripcion_corta_es, descripcion_corta_en
--   from productos
--   where id in (
--     '6efbccfc-b183-4f25-b2ac-51509e4eeaa2',
--     'e60b97e6-bb85-40e3-9b6a-394ad9f5e41f',
--     '00f47c69-d33e-4dca-bbc5-6ce2b993bafd'
--   );
