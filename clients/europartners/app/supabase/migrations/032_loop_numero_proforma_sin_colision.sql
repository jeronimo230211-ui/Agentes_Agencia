-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 032 — Numeración de proformas: loop anti-colisión +
-- reinicio definitivo de la secuencia a partir de 3-0260
-- Incremental, no destructiva — ver nota en migración 001.
--
-- ── Contexto (investigado antes de esta migración) ────────────────
-- `proforma_numero_seq` + el trigger `trg_numero_proforma` (función
-- `generar_numero_proforma()`, BEFORE INSERT, solo actúa si
-- `new.numero = ''`) vienen de supabase/schema_v2.sql líneas 154 y
-- 190-198. Hoy generan el número como `'3-' || lpad(nextval(...), 4,
-- '0')` a ciegas: un solo nextval(), sin revisar si ese número ya
-- existe.
--
-- Estado real confirmado (nov-2026): por pruebas de QA/dev de la
-- última semana quedó un rango de números "quemados" sin usar:
--   3-0260 a 3-0262  → LIBRES
--   3-0263            → OCUPADO (proforma real, estado borrador)
--   3-0264 a 3-0278  → LIBRES
--   3-0279 / 3-0280   → OCUPADOS (descartadas)
--   3-0281            → OCUPADO (proforma real, estado borrador — la
--                        más alta hoy)
-- El siguiente nextval() daría 3-0282. Jerónimo quiere recuperar el
-- rango libre y que la numeración vuelva a seguir desde 3-0260 en
-- forma DEFINITIVA, no como parche puntual.
--
-- El riesgo de solo resetear la secuencia (`setval(seq, 259)`) es que,
-- al subir, en algún punto el contador va a volver a caer exactamente
-- en 263 y en 281 — que YA EXISTEN. Si eso pasa mientras alguien está
-- creando una proforma real, el INSERT choca contra el `unique` de
-- `proformas.numero` (error 23P01/23505) y el usuario ve un error.
--
-- ── Qué hace ──────────────────────────────────────────────────────
-- 1. Reemplaza `generar_numero_proforma()` (CREATE OR REPLACE, mismo
--    nombre y firma — el trigger `trg_numero_proforma` no se toca)
--    para que en vez de un nextval() ciego, genere un candidato y, si
--    ya existe en `proformas.numero`, lo descarte y pida el siguiente
--    nextval(), en loop — todo DENTRO del mismo trigger BEFORE INSERT
--    de la fila que se está insertando. No hay ventana de carrera
--    "revisar si existe" vs. "usarlo": cada nextval() ya es atómico y
--    único entre transacciones concurrentes (las secuencias de
--    Postgres no son transaccionales), así que dos proformas
--    creándose al mismo tiempo nunca reciben el mismo candidato: el
--    `unique not null` de `numero` sigue siendo la protección final,
--    pero con el loop ya no debería dispararse en el camino feliz.
-- 2. Límite de 1000 intentos: si se agota, el INSERT falla con un
--    `raise exception` explícito y legible (no un error silencioso ni
--    un loop infinito).
-- 3. La condición que ya existía NO cambia: el loop solo corre si
--    `new.numero = ''`. Si algún código llega a mandar `numero`
--    explícito (distinto de `''`), el trigger sigue sin tocarlo —
--    igual que hoy.
-- 4. Reinicia `proforma_numero_seq` con
--    `select setval('proforma_numero_seq', 259, true)` → el próximo
--    `nextval()` entrega 260. A partir de ahí, el loop del punto 1 es
--    lo que garantiza que 263, 279, 280 y 281 se salten solos sin que
--    nadie vea un error — por eso el reset y el loop van en la misma
--    migración: el reset solo es seguro con el loop ya puesto.
--
-- ── Impacto en la app ──────────────────────────────────────────────
-- Ninguno sobre código: la app nunca llama a `generar_numero_proforma()`
-- directamente, solo inserta en `proformas` con `numero: ''` (o sin
-- mandar la columna) y deja que el trigger la rellene — eso no cambia.
-- No hay nada que el developer tenga que tocar. El único efecto
-- visible es que la numeración vuelve a 3-0260 en la próxima proforma
-- que se cree después de correr esto, y los huecos 263/279/280/281 se
-- saltan automáticamente cuando el contador llegue a ellos.
--
-- ── Cómo verificar (Jerónimo, en el SQL Editor de Supabase) ───────
--
-- PASO 0 — ANTES de correr nada: ver el mapa de números ocupados en
-- el rango que vas a recuperar (solo lectura, no cambia nada, lo
-- puedes correr cuantas veces quieras):
--
--   select
--     n as numero_seq,
--     '3-' || lpad(n::text, 4, '0') as numero_formateado,
--     exists (
--       select 1 from proformas p
--       where p.numero = '3-' || lpad(n::text, 4, '0')
--     ) as ya_existe,
--     (select estado from proformas p
--      where p.numero = '3-' || lpad(n::text, 4, '0')) as estado_si_existe
--   from generate_series(260, 282) as n
--   order by n;
--
-- Resultado esperado: `ya_existe = true` SOLO en 263, 279, 280 y 281
-- (con sus estados: borrador, descartada, descartada, borrador). Todo
-- lo demás debe salir `false`. Si ves algo distinto (por ejemplo una
-- proforma real nueva creada en 264-278 mientras tanto), AVISA antes
-- de seguir — el loop de todas formas la saltaría sola, pero es mejor
-- confirmar que el mapa sigue siendo el esperado.
--
-- PASO 0.5 (opcional, recomendado) — probar el loop de la función
-- EN AISLAMIENTO, sin tocar la secuencia real ni insertar nada, para
-- ver con tus propios ojos que salta 263 y 281 antes de aplicar nada:
--
--   do $$
--   declare
--     candidato text;
--     n int;
--   begin
--     create temporary sequence if not exists test_numero_seq_032;
--     perform setval('test_numero_seq_032', 259, true);
--     for i in 1..30 loop
--       n := nextval('test_numero_seq_032');
--       candidato := '3-' || lpad(n::text, 4, '0');
--       if exists (select 1 from proformas where numero = candidato) then
--         raise notice '% -> OCUPADO, se saltaría', candidato;
--       else
--         raise notice '% -> se asignaría', candidato;
--       end if;
--     end loop;
--     drop sequence test_numero_seq_032;
--   end $$;
--
-- Mira los "NOTICE" en la pestaña de resultados/logs: debe decir
-- "OCUPADO, se saltaría" exactamente en 3-0263, 3-0279, 3-0280 y
-- 3-0281, y "se asignaría" en los demás (260, 261, 262, 264..278, 282
-- en adelante). Esto usa una secuencia temporal de la sesión — no
-- toca `proforma_numero_seq` ni inserta nada en `proformas`.
--
-- PASO 1 — abre el SQL Editor del proyecto Europartners → pega este
-- archivo completo (032_loop_numero_proforma_sin_colision.sql) → Run.
--
-- PASO 2 — confirma que la secuencia quedó en el punto correcto (solo
-- lectura, no consume ningún número — NO uses nextval() para esto):
--
--   select last_value, is_called from proforma_numero_seq;
--   -- esperado: last_value = 259, is_called = true
--   -- (eso significa que el PRÓXIMO nextval() entrega 260)
--
-- PASO 3 — confirmación real: crea una proforma nueva desde la app
-- (no por SQL) y verifica que le tocó el número "3-0260":
--
--   select numero, estado, created_at
--   from proformas
--   order by created_at desc
--   limit 1;
--
-- ⚠️ NO verifiques esto con un INSERT de prueba + ROLLBACK en el SQL
-- Editor: aunque hagas BEGIN...ROLLBACK, el avance de la secuencia NO
-- se revierte (las secuencias de Postgres no son transaccionales), así
-- que un "test" así consumiría igual números reales del rango que
-- acabamos de recuperar. Usa siempre el PASO 0.5 (secuencia temporal)
-- para probar el loop, y la app (PASO 3) para la confirmación real.
-- ══════════════════════════════════════════════════════════════

create or replace function generar_numero_proforma()
returns trigger
language plpgsql
as $$
declare
  candidato    text;
  intentos     int := 0;
  max_intentos int := 1000;
begin
  if new.numero = '' then
    loop
      intentos := intentos + 1;
      candidato := '3-' || lpad(nextval('proforma_numero_seq')::text, 4, '0');

      if not exists (select 1 from proformas where numero = candidato) then
        new.numero := candidato;
        exit;
      end if;

      if intentos >= max_intentos then
        raise exception
          'generar_numero_proforma: no se encontró un número de proforma libre tras % intentos (último candidato probado: %). Revisa proforma_numero_seq y el rango ocupado en proformas.numero.',
          max_intentos, candidato;
      end if;
    end loop;
  end if;

  return new;
end;
$$;

-- Reinicio definitivo: el próximo nextval() entrega 260.
select setval('proforma_numero_seq', 259, true);
