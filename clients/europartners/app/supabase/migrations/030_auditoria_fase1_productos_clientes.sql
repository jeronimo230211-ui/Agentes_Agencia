-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 030 — Trazabilidad (auditoría) Fase 1: productos + clientes
-- Incremental, no destructiva — ver nota en migración 001.
--
-- ── Qué hace ──────────────────────────────────────────────────────
-- Implementa el mecanismo híbrido de trazabilidad aprobado por Jero:
--   1. Tabla genérica `auditoria_eventos` — una fila por cada create/
--      update/delete de cualquier tabla auditada, con el JSON completo
--      del registro antes y después del cambio.
--   2. Columna `actualizado_por uuid` en `productos` y `clientes` — el
--      "quién" lo pone la app cuando escribe (ver pendiente al final).
--   3. Una sola función PL/pgSQL genérica (`registrar_auditoria_evento`),
--      reutilizable: se adjunta con `create trigger` a cada tabla que se
--      quiera auditar, sin duplicar lógica por tabla.
--   4. Triggers AFTER INSERT/UPDATE/DELETE en `productos` y `clientes`
--      usando esa función (Fase 1 — el alcance que Jero aprobó ahora).
--
-- ── Por qué ───────────────────────────────────────────────────────
-- Hoy, si un precio o un dato de cliente cambia, no hay forma de saber
-- QUIÉN lo cambió, CUÁNDO, ni qué valor tenía ANTES — solo se ve el
-- estado actual. Esto ya mordió al proyecto antes (incidente de la
-- migración 027: una proforma perdió sus líneas sin que quedara rastro
-- de qué pasó). `auditoria_eventos` es la base para que Marta/Jero
-- puedan reconstruir "qué pasó" sin depender de la memoria de nadie.
--
-- ── Por qué el trigger captura el evento SIEMPRE, aunque falte el actor ──
-- El trigger lee `actualizado_por` de NEW (o de OLD en un DELETE) para
-- llenar `usuario_id`, pero si ese campo viene null (p. ej. porque el
-- endpoint que hizo el UPDATE todavía no lo manda — ver pendiente abajo)
-- el evento se inserta igual, solo con `usuario_id = null`. Nunca se
-- descarta un evento por falta de actor: el "qué cambió y cuándo" es
-- más valioso capturado con hueco que no capturado.
--
-- ── Refinamiento: no hay ruido por updates triviales de `updated_at` ──
-- Varios endpoints de este repo reescriben `updated_at = now()` en CADA
-- guardado, incluso si no cambió nada más (ver app/api/productos/[id]/
-- route.ts). Sin este refinamiento, cada guardado generaría un evento
-- "update" con datos_anteriores == datos_nuevos salvo el timestamp —
-- ruido puro. El trigger compara NEW y OLD completos (en JSON) quitando
-- la clave `updated_at` de ambos lados; si tras eso son idénticos, NO
-- inserta evento. Esto es defensivo y genérico (usa el operador jsonb
-- `- 'updated_at'`, que simplemente no hace nada si la tabla no tiene
-- esa columna) — no asume que toda tabla futura la tenga.
--
-- ── Por qué la función NO es security definer ────────────────────
-- Solo `service_role` escribe en `productos`/`clientes` hoy (RLS de
-- ambas: "service_all" únicamente, ninguna policy de escritura para
-- `authenticated` — ver schema_v2.sql). `service_role` ya bypassa RLS
-- de cualquier tabla, incluida `auditoria_eventos`, así que la función
-- no necesita privilegios elevados para poder insertar el evento: corre
-- con los permisos normales de quien dispara el trigger (igual que
-- `recalcular_estado_pago_proforma` en la migración 021). Menos
-- privilegio que el estrictamente necesario = menos superficie si algo
-- sale mal.
--
-- ── Fuera de alcance de esta migración (decidido con Jero) ────────
-- - NO se toca `proforma_eventos` ni `solicitud_eventos` — siguen como
--   están, con su propia lógica específica de negocio.
-- - NO se le pone este trigger a `proforma_lineas` ni `solicitud_lineas`
--   — ambas usan el patrón delete-completo + reinsert al guardar, así
--   que el trigger genérico generaría un evento "delete" + N eventos
--   "create" en cada guardado normal, puro ruido sin valor real.
-- - Fase 2 (fuera de esta migración): extender a más tablas si Jero lo
--   aprueba después.
--
-- ── Seguridad / RLS de auditoria_eventos ──────────────────────────
-- Mismo patrón estándar de este repo: "read_auth" (solo `authenticated`,
-- para que Deisy/Marta puedan ver el historial desde la app) +
-- "service_all" (`service_role`). Nada para `anon` — esta tabla expone
-- diffs de precios de productos y datos de clientes, exactamente el
-- tipo de dato que no debe quedar público (ver migración 023).
--
-- ── Impacto en la app ──────────────────────────────────────────────
-- Ninguno sobre lo que ya funciona: no se renombra ni se quita ninguna
-- columna existente, solo se agrega `actualizado_por` (nullable) y una
-- tabla nueva. El guardado de productos/clientes sigue funcionando
-- exactamente igual aunque nadie mande `actualizado_por` todavía.
--
-- ── PENDIENTE para agency-developer (fuera de esta migración) ─────
-- Para que el "quién" quede completo (hoy quedará en null), hay que
-- agregar `actualizado_por: session.user.id` al payload que mandan a
-- Supabase los endpoints de escritura de productos y clientes:
--   - app/api/productos/[id]/route.ts  (PATCH, línea ~83, objeto `update`)
--   - app/api/clientes/[id]/route.ts   (su PATCH equivalente)
-- (También conviene revisarlo en los POST de creación de ambos, si
-- existen, para que el "create" también quede atribuido.)
--
-- ── Cómo verificar (Jerónimo, en el SQL Editor de Supabase) ───────
-- 1. Abre el SQL Editor del proyecto Europartners.
-- 2. Pega este archivo completo (030_auditoria_fase1_productos_clientes.sql).
-- 3. Run.
-- 4. Corre estas 3 queries de verificación, en orden:
--
--    -- A) un cambio real en un producto queda registrado con su actor:
--    update productos
--    set notas = coalesce(notas, '') || ' [test auditoria 030]',
--        actualizado_por = (select id from usuarios limit 1)
--    where id = (select id from productos order by created_at desc limit 1)
--    returning id, notas;
--
--    select tabla_afectada, accion, usuario_id, datos_anteriores->>'notas' as notas_antes,
--           datos_nuevos->>'notas' as notas_despues, created_at
--    from auditoria_eventos
--    order by created_at desc
--    limit 1;
--    -- esperado: accion='update', usuario_id = el id usado arriba,
--    -- notas_despues termina en "[test auditoria 030]", notas_antes no.
--
--    -- B) revertir el cambio de prueba (esto también debe auditarse):
--    update productos
--    set notas = replace(notas, ' [test auditoria 030]', '')
--    where id = (select id from productos order by created_at desc limit 1);
--
--    -- C) un update que SOLO toca updated_at no genera ruido:
--    update productos set updated_at = now()
--    where id = (select id from productos order by created_at desc limit 1);
--
--    select count(*) from auditoria_eventos
--    where tabla_afectada = 'productos' and created_at > now() - interval '5 minutes';
--    -- esperado: 2 (los de A y B) — el update de C) NO debe sumar un tercero.
-- ══════════════════════════════════════════════════════════════

-- ── 1. Tabla genérica de eventos de auditoría ───────────────────
create table if not exists auditoria_eventos (
  id               uuid primary key default gen_random_uuid(),
  tabla_afectada   text not null,
  registro_id      uuid not null,
  accion           text not null check (accion in ('create', 'update', 'delete')),
  usuario_id       uuid references usuarios(id),
  origen           text not null default 'trigger_db'
                   check (origen in ('trigger_db', 'app')),
  datos_anteriores jsonb,
  datos_nuevos     jsonb,
  created_at       timestamptz default now()
);

create index if not exists idx_auditoria_tabla_registro
  on auditoria_eventos (tabla_afectada, registro_id, created_at desc);

-- ── 2. "Quién" — columna en cada tabla auditada Fase 1 ───────────
alter table productos add column if not exists actualizado_por uuid references usuarios(id);
alter table clientes  add column if not exists actualizado_por uuid references usuarios(id);

-- ── 3. Función genérica del trigger ───────────────────────────────
-- Una sola función para todas las tablas auditadas: no asume columnas
-- específicas de ninguna tabla (usa to_jsonb / claves jsonb en vez de
-- referenciar campos por nombre), así que sirve igual si en el futuro
-- se adjunta a una tabla sin `actualizado_por` o sin `updated_at`.
create or replace function public.registrar_auditoria_evento()
returns trigger
language plpgsql
as $$
declare
  v_old    jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new    jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_accion text  := case tg_op
                       when 'INSERT' then 'create'
                       when 'UPDATE' then 'update'
                       when 'DELETE' then 'delete'
                     end;
  v_actor  uuid;
begin
  -- Refinamiento: update que solo toca `updated_at` no genera evento.
  -- Si la tabla no tiene esa columna, `- 'updated_at'` no hace nada y
  -- la comparación sigue siendo exacta (sin falsos negativos).
  if tg_op = 'UPDATE' and (v_old - 'updated_at') = (v_new - 'updated_at') then
    return new;
  end if;

  -- `actualizado_por` puede no existir en la tabla (->> devuelve null
  -- en ese caso, no un error) — el "quién" queda null, el evento igual
  -- se captura.
  v_actor := coalesce(
    (v_new ->> 'actualizado_por')::uuid,
    (v_old ->> 'actualizado_por')::uuid
  );

  insert into auditoria_eventos (
    tabla_afectada, registro_id, accion, usuario_id, origen,
    datos_anteriores, datos_nuevos
  )
  values (
    tg_table_name,
    coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid),
    v_accion,
    v_actor,
    'trigger_db',
    v_old,
    v_new
  );

  return coalesce(new, old);
end;
$$;

-- ── 4. Triggers — Fase 1: solo productos y clientes ───────────────
drop trigger if exists trg_auditoria_productos on productos;
create trigger trg_auditoria_productos
  after insert or update or delete on productos
  for each row execute function registrar_auditoria_evento();

drop trigger if exists trg_auditoria_clientes on clientes;
create trigger trg_auditoria_clientes
  after insert or update or delete on clientes
  for each row execute function registrar_auditoria_evento();

-- ── 5. RLS de auditoria_eventos ───────────────────────────────────
alter table auditoria_eventos enable row level security;

create policy "read_auth"   on auditoria_eventos for select using (auth.role() = 'authenticated');
create policy "service_all" on auditoria_eventos for all    using (auth.role() = 'service_role');
