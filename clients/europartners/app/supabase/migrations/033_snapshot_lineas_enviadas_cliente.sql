-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 033 — Snapshot de líneas al momento de enviar al cliente
-- + vistas de comparación "qué se mandó" vs. "qué hay hoy"
-- Incremental, no destructiva — ver nota en migración 001.
--
-- ── Contexto / por qué (aprobado por Jero) ────────────────────────
-- Hoy `proforma_lineas` solo tiene el estado ACTUAL de cada línea.
-- Cuando se edita una proforma, la ruta PUT /api/proformas/[id]
-- (app/api/proformas/[id]/route.ts, líneas ~154-186) hace un DELETE
-- completo de `proforma_lineas` seguido de un INSERT fresco — NO un
-- UPDATE por línea. Eso significa que `proforma_lineas.id` NUNCA es
-- estable entre guardados: aunque una línea no cambie en contenido,
-- su fila (y su id) se recrea. Confirmado también en el comentario de
-- la migración 030 ("ambas usan el patrón delete-completo + reinsert
-- al guardar").
--
-- Consecuencia de negocio: si una proforma se envía al cliente
-- (aprobada → enviada), se le factura después, y en el medio alguien
-- corrige una cantidad o un precio de costo (ya pasó: ver
-- fix-margenes-desincronizados y fix-costo-tz0425hs-free-3-0126 en
-- scripts/migrate-excel), hoy NO HAY FORMA de reconstruir qué fue
-- exactamente lo que el cliente vio y aprobó, porque la única copia
-- de las líneas es la actual, ya corregida. Jero aprobó la Opción A:
-- una tabla de snapshot, tomada en el momento `aprobada → enviada`
-- (el envío al cliente para que él apruebe — NO en `en_revision →
-- aprobada`, que es un momento interno más temprano, antes de que el
-- cliente vea nada).
--
-- ── Qué hace esta migración ───────────────────────────────────────
-- 1. Tabla `proforma_lineas_snapshot`: copia congelada de las líneas
--    de una proforma en un momento dado. `tipo` queda como columna
--    (default/único valor hoy: 'enviada_cliente') para poder agregar
--    otros tipos de snapshot en el futuro (ej. 'aprobada_interna') sin
--    rediseñar la tabla — solo hace falta extender el check constraint
--    en una migración futura:
--      alter table proforma_lineas_snapshot
--        drop constraint proforma_lineas_snapshot_tipo_check,
--        add constraint proforma_lineas_snapshot_tipo_check
--          check (tipo in ('enviada_cliente', 'el_nuevo_tipo'));
-- 2. Función RPC `snapshot_lineas_proforma_enviada(p_proforma_id uuid)`:
--    copia las líneas ACTUALES de `proforma_lineas` a
--    `proforma_lineas_snapshot` con `tipo='enviada_cliente'`.
-- 3. Dos vistas de comparación, de solo lectura:
--    `proforma_lineas_comparacion_v` (por línea) y
--    `proforma_totales_comparacion_v` (totales por proforma).
--
-- ── Por qué DELETE+INSERT va en una función RPC (no en el endpoint) ──
-- Regla no negociable de este repo: una operación de varios pasos que
-- no puede quedar a medias (borrar+reinsertar) va en una función
-- PL/pgSQL, que es una sola transacción. Es exactamente el error que
-- YA pasó en este proyecto con `proforma_lineas` desde el propio
-- endpoint (incidente del 2026-10-05/06, proforma 3-0253, ver
-- migración 027) — un DELETE en una llamada seguido de un INSERT en
-- otra llamada separada puede dejar la proforma con 0 líneas si el
-- segundo paso falla o el proceso se interrumpe en el medio. Aquí el
-- DELETE+INSERT de `proforma_lineas_snapshot` ocurre DENTRO de
-- `snapshot_lineas_proforma_enviada()`, una sola función = una sola
-- transacción: si el INSERT falla, el DELETE se revierte solo y el
-- snapshot anterior (si existía) queda intacto, nunca en 0 líneas.
--
-- (Nota aparte, fuera de alcance de esta migración: el mismo patrón
-- delete-sin-transacción que causó el incidente de 3-0253 sigue sin
-- una función RPC en app/api/proformas/[id]/route.ts — hoy se mitiga
-- cortando el guardado si el INSERT falla, pero el DELETE ya corrió en
-- una llamada aparte. Si Jero quiere, es una migración separada:
-- envolver ESE guardado también en una función RPC.)
--
-- ── Decisión de idempotencia (reintento de "enviar al cliente") ───
-- `snapshot_lineas_proforma_enviada()` primero BORRA cualquier
-- snapshot `tipo='enviada_cliente'` previo de esa proforma y luego
-- INSERTA una copia fresca de las líneas actuales — siempre deja
-- exactamente un snapshot "enviada_cliente" vigente por proforma (no
-- se acumulan copias). Dos razones:
--   (a) Reintento idéntico (doble click, retry de red): el resultado
--       es el mismo snapshot de nuevo, sin acumular filas basura.
--   (b) Reenvío real con líneas corregidas (Marta reenvía el PDF tras
--       un ajuste): el snapshot se reemplaza por el que de verdad se
--       mandó la última vez — que es justo lo que se quiere comparar
--       contra lo facturado, no una versión vieja y ya obsoleta.
-- Se usa un `pg_advisory_xact_lock` sobre el proforma_id al inicio de
-- la función para serializar dos llamadas concurrentes a la misma
-- proforma (evita, en la peor coincidencia de timing, que un DELETE y
-- un INSERT de dos llamadas distintas se entrelacen) — el lock se
-- libera solo al terminar la transacción.
--
-- ── Matching snapshot vs. actual (vistas de comparación) ───────────
-- Se matchea por producto_id+variante_id+componente_id si producto_id
-- no es null; si es null, fallback por codigo_pdf — MISMO criterio que
-- ya usa margen_por_categoria_v (migración 029) para cruzar
-- historial_precios con productos.
--
-- HALLAZGO REAL durante la verificación (ver abajo, proforma 3-0122):
-- en proformas más viejas (importadas de Excel, producto_id null en
-- TODAS las líneas) es común que el MISMO codigo_pdf se repita varias
-- veces en la misma proforma con cantidad/precio distintos (lotes de
-- costo distintos del mismo código — ej. "CH-T006-60A" aparece 3 veces
-- en 3-0122 con cantidades 12/20/10). Si se matcheara solo por
-- codigo_pdf, una sola clave repetida generaría un cruce ambiguo
-- (varias líneas de cada lado con la misma clave). Esta migración lo
-- resuelve con un `row_number() over (partition by proforma_id,
-- match_key order by orden)` en cada lado y matchea (match_key, rn):
-- la 1ª línea de ese código en el snapshot contra la 1ª línea de ese
-- código hoy, la 2ª contra la 2ª, etc. Si se agregó o se cayó un lote
-- de ese código, el/los sobrante(s) quedan al final del grupo y se
-- marcan "agregada"/"caida" normalmente — no se pierden ni se inventan.
--
-- Límite conocido (no se "arregla" porque no hay dato para arreglarlo):
-- si producto_id Y codigo_pdf son ambos null en una línea, su match_key
-- queda como 'cod:' (vacío) — todas las líneas así de la MISMA
-- proforma caen en un solo grupo y se emparejan solo por posición
-- (orden). Es el último recurso posible con los datos que hay; no se
-- vio ningún caso real así en la muestra verificada (3-0122 siempre
-- tiene codigo_pdf poblado), pero se documenta por si aparece en otra
-- proforma vieja.
--
-- `proforma_lineas_comparacion_v` incluye la columna `tiene_snapshot`
-- (true si existe AL MENOS UN snapshot 'enviada_cliente' para esa
-- proforma). Es importante para la UI: una proforma que nunca pasó
-- por este flujo nuevo (todo lo facturado ANTES de correr esta
-- migración, o cualquier proforma que nunca llegó a 'enviada') no
-- tiene snapshot — en ese caso TODAS sus líneas actuales saldrían como
-- "agregada" por el full outer join, lo cual sería engañoso (no es que
-- se agregaron después del envío, es que no hay dato histórico). El
-- frontend debe mostrar "sin snapshot disponible" cuando
-- `tiene_snapshot = false`, no "agregada".
--
-- ── Seguridad / RLS ────────────────────────────────────────────────
-- `proforma_lineas_snapshot`: mismo patrón estándar de este repo —
-- "read_auth" (authenticated) + "service_all" (service_role). NO se
-- agrega policy de escritura para `authenticated` (como la que sí
-- tiene `proforma_lineas` vía "lineas_write"): esta tabla SOLO la
-- escribe `snapshot_lineas_proforma_enviada()`, llamada desde
-- app/api/proformas/[id]/enviar-cliente/route.ts con el cliente
-- admin (service_role) — nunca se escribe desde el navegador con
-- sesión de usuario. Mismo criterio que ya usa `historial_precios`
-- (solo read_auth + service_all, sin write para authenticated).
--
-- La función `snapshot_lineas_proforma_enviada()` hace un
-- DELETE+INSERT real sobre datos de negocio — a diferencia de
-- `listar_tablas_backup()` (migración 027, solo lectura, sin
-- restricción de EXECUTE), esta función SÍ se restringe: PostgREST
-- expone automáticamente toda función de `public` como endpoint RPC
-- (`/rest/v1/rpc/...`), y por default Postgres otorga EXECUTE a
-- PUBLIC (incluye `anon`). Sin restringirlo, cualquiera con la anon
-- key pública podría llamar esta función con cualquier proforma_id y
-- pisar su snapshot real con el estado actual (arruinando el propósito
-- mismo de la auditoría) sin pasar por ningún control de la app. Por
-- eso: `revoke execute ... from public` + `grant execute ... to
-- service_role` únicamente.
--
-- Las 2 vistas se crean con `security_invoker = true` (mismo fix que
-- la migración 023 y las 4 vistas de la migración 029, por la misma
-- razón: sin esto, una vista corre con los permisos de quien la CREÓ
-- en vez de quien la CONSULTA, y se salta el RLS de las tablas base).
-- Con security_invoker, heredan el RLS de `proforma_lineas_snapshot`,
-- `proforma_lineas` y `proformas` — anon sigue sin ver nada.
--
-- ── Índices ────────────────────────────────────────────────────────
-- `idx_lineas_snapshot_proforma_tipo` en (proforma_id, tipo) — es el
-- filtro exacto que usa la función RPC (DELETE) y las vistas.
--
-- ── Impacto en la app ──────────────────────────────────────────────
-- 1. YA SE EDITÓ app/api/proformas/[id]/enviar-cliente/route.ts (en el
--    mismo cambio que esta migración): justo después de validar
--    estado/email y antes de generar el PDF, llama
--    `adminClient.rpc('snapshot_lineas_proforma_enviada', { p_proforma_id:
--    params.id })`. Si falla, solo se loguea (console.error) — NO
--    bloquea el envío real al cliente: el snapshot es para auditoría
--    futura, no es parte del flujo de aprobación/pago. Esta función
--    SQL no existe hasta que Jero corra esta migración — el código ya
--    quedó escrito pero la llamada fallará (y solo logueará, sin
--    romper el envío) hasta que el PASO 1 de abajo se corra en
--    Supabase. agency-developer/QA debe revisar este diff como
--    cualquier cambio de código antes de la próxima entrega.
-- 2. No hay UI todavía para las vistas de comparación — queda para
--    una pantalla futura (agency-developer), que puede consumirlas
--    directo: `select * from proforma_lineas_comparacion_v where
--    proforma_id = $1` y `select * from proforma_totales_comparacion_v
--    where proforma_id = $1`.
-- 3. Nada existente cambia de comportamiento para el flujo de envío ni
--    para ninguna pantalla hoy visible. Aditivo en base de datos;
--    en código, un solo bloque nuevo que no puede romper el envío.
--
-- ── Verificación con datos reales (solo lectura, 2026-11-24) ──────
-- Se usó la proforma real 3-0122 (HJB Jamaica, estado 'facturada',
-- 27 líneas, fecha 2025-03-24) para validar el mecanismo de matching
-- ANTES de escribir esta migración (consulta de solo lectura vía
-- scripts/migrate-excel/_check-snapshot-ejemplo-readonly.mjs, sin
-- escribir nada). 3-0122 es anterior a este flujo, así que NO existe
-- un snapshot real para ella — lo de abajo es una SIMULACIÓN para
-- ilustrar el comportamiento de las vistas, no un resultado real.
--
-- Caso A — snapshot idéntico a lo actual (lo esperable si nada se
-- corrigió después del envío): las 27 líneas machean 1:1 (incluyendo
-- los grupos de codigo_pdf repetido, ej. las 3 líneas "CH-T006-60A"
-- con cantidad 12/20/10 se emparejan por orden con sus 3 contrapartes
-- idénticas), `estado_linea = 'coincide'` en las 27, `cambio_detectado
-- = false` en las 27, y en `proforma_totales_comparacion_v`:
-- total_snapshot_cliente_usd = total_actual_cliente_usd = 25,111.76
-- (coincide con total_cif_usd actual), n_lineas_con_cambio = 0.
--
-- Caso B — HIPOTÉTICO (dato inventado para ilustrar, NO pasó de
-- verdad en 3-0122): supongamos que, tras enviarla al cliente, alguien
-- corrige la línea orden=4 (CH-T007L-70, cantidad 20) a cantidad 18
-- porque sobraron 2 unidades fuera del contenedor, y también corrige
-- precio_costo_usd de la línea orden=11 (codigo "24", costo 17.85) a
-- 18.50 por un ajuste de tasa. Resultado esperado de la vista:
--   - orden=4 (CH-T007L-70, precio_cliente_usd=84.81):
--     estado_linea='coincide', cambio_detectado=true,
--     snapshot_cantidad=20 vs actual_cantidad=18,
--     snapshot_subtotal_cliente_usd=1696.20 vs actual=1526.58
--     (18 × 84.81), snapshot_subtotal_costo_usd=1475.00 vs
--     actual=1327.50 (18 × 73.75)
--   - orden=11 (codigo "24", precio_costo_usd 17.85→18.50, cantidad
--     y precio_cliente_usd sin cambio): estado_linea='coincide',
--     cambio_detectado=true, snapshot_precio_costo_usd=17.85 vs
--     actual=18.50, subtotal_costo_usd snapshot=535.50 vs
--     actual=555.00 (30 × 18.50) — subtotal_cliente_usd queda igual
--     (589.20) porque en este ejemplo solo cambia el costo, no el
--     precio al cliente
--   - las otras 25 líneas: 'coincide', cambio_detectado=false
--   - proforma_totales_comparacion_v: total_actual_cliente_usd queda
--     169.62 USD por debajo de total_snapshot_cliente_usd (solo por
--     la baja de 2 unidades en orden=4 — el cambio de orden=11 es puro
--     costo, no mueve el total al cliente), n_lineas_con_cambio = 2
--
-- ── Cómo verificar (Jerónimo, en el SQL Editor de Supabase) ───────
--
-- PASO 1 — abre el SQL Editor del proyecto Europartners → pega este
-- archivo completo (033_snapshot_lineas_enviadas_cliente.sql) → Run.
--
-- PASO 2 — confirma que la tabla, el índice, la función y las 2 vistas
-- quedaron creadas (solo lectura):
--
--   select count(*) from proforma_lineas_snapshot;  -- esperado: 0
--
--   select routine_name, security_type
--   from information_schema.routines
--   where routine_name = 'snapshot_lineas_proforma_enviada';
--   -- esperado: 1 fila, security_type = 'INVOKER'
--
--   select grantee, privilege_type
--   from information_schema.routine_privileges
--   where routine_name = 'snapshot_lineas_proforma_enviada';
--   -- esperado: SOLO service_role con EXECUTE (ni PUBLIC ni anon ni
--   -- authenticated deben aparecer aquí)
--
-- PASO 3 — prueba la función en aislamiento con una proforma real que
-- SÍ tenga líneas (no hace falta que esté en estado 'aprobada' para
-- esta prueba manual — la función no valida estado, solo copia). Usa
-- una proforma que no te importe "tocar" el snapshot, ej. 3-0122:
--
--   select snapshot_lineas_proforma_enviada(
--     (select id from proformas where numero = '3-0122')
--   );
--
--   select tipo, count(*), min(created_at), max(created_at)
--   from proforma_lineas_snapshot
--   where proforma_id = (select id from proformas where numero = '3-0122')
--   group by tipo;
--   -- esperado: 1 fila, tipo='enviada_cliente', count=27
--
-- PASO 4 — confirma que las vistas de comparación muestran "todo
-- coincide" (porque el snapshot que acabas de crear en el PASO 3 es
-- una copia exacta de lo actual, nada cambió en el medio):
--
--   select estado_linea, cambio_detectado, count(*)
--   from proforma_lineas_comparacion_v
--   where proforma_id = (select id from proformas where numero = '3-0122')
--   group by estado_linea, cambio_detectado;
--   -- esperado: 1 fila → estado_linea='coincide', cambio_detectado=false, count=27
--
--   select * from proforma_totales_comparacion_v
--   where proforma_id = (select id from proformas where numero = '3-0122');
--   -- esperado: total_snapshot_cliente_usd = total_actual_cliente_usd = 25111.76,
--   -- n_lineas_coinciden=27, n_lineas_con_cambio=0, n_lineas_caidas=0,
--   -- n_lineas_agregadas=0, tiene_snapshot=true
--
-- PASO 5 (opcional, prueba del caso con diferencia real) — edita una
-- línea de esa MISMA proforma desde la app (o con un UPDATE manual de
-- prueba sobre una proforma de prueba, nunca sobre 3-0122 real) y
-- vuelve a correr las queries del PASO 4: las líneas que cambiaron
-- deben salir `cambio_detectado = true` con el antes/después visible.
--
-- PASO 6 — limpia el snapshot de prueba que creaste en el PASO 3 (no
-- se queda nada corrupto en producción, pero tampoco tiene sentido
-- dejar un snapshot "enviada_cliente" falso para una proforma que en
-- realidad nunca se reenvió por este flujo):
--
--   delete from proforma_lineas_snapshot
--   where proforma_id = (select id from proformas where numero = '3-0122')
--     and tipo = 'enviada_cliente';
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- 1. TABLA — snapshot de líneas
-- ══════════════════════════════════════════════════════════════
create table if not exists proforma_lineas_snapshot (
  id                   uuid primary key default gen_random_uuid(),
  proforma_id          uuid references proformas(id) on delete cascade not null,
  tipo                 text not null default 'enviada_cliente'
                       check (tipo in ('enviada_cliente')),
  producto_id          uuid references productos(id),
  variante_id          uuid references producto_variantes(id),
  componente_id        uuid references producto_componentes(id),
  descripcion_pdf      text not null,
  codigo_pdf           text,
  cantidad             integer not null default 1,
  precio_costo_usd     numeric(12,4),
  precio_cliente_usd   numeric(12,4),
  margen_pct           numeric(6,4),
  subtotal_costo_usd   numeric(12,2),
  subtotal_cliente_usd numeric(12,2),
  orden                int not null default 0,
  created_at           timestamptz default now()
);

create index if not exists idx_lineas_snapshot_proforma_tipo
  on proforma_lineas_snapshot (proforma_id, tipo);

alter table proforma_lineas_snapshot enable row level security;

drop policy if exists "read_auth" on proforma_lineas_snapshot;
create policy "read_auth" on proforma_lineas_snapshot
  for select using (auth.role() = 'authenticated');

drop policy if exists "service_all" on proforma_lineas_snapshot;
create policy "service_all" on proforma_lineas_snapshot
  for all using (auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════════
-- 2. FUNCIÓN RPC — toma el snapshot (delete+insert atómico)
-- ══════════════════════════════════════════════════════════════
create or replace function snapshot_lineas_proforma_enviada(p_proforma_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  -- Serializa llamadas concurrentes para la MISMA proforma dentro de
  -- esta transacción (se libera sola al terminar). Ver nota de
  -- idempotencia en la cabecera de esta migración.
  perform pg_advisory_xact_lock(hashtext(p_proforma_id::text)::bigint);

  delete from proforma_lineas_snapshot
  where proforma_id = p_proforma_id
    and tipo = 'enviada_cliente';

  insert into proforma_lineas_snapshot (
    proforma_id, tipo, producto_id, variante_id, componente_id,
    descripcion_pdf, codigo_pdf, cantidad, precio_costo_usd,
    precio_cliente_usd, margen_pct, subtotal_costo_usd,
    subtotal_cliente_usd, orden
  )
  select
    proforma_id, 'enviada_cliente', producto_id, variante_id, componente_id,
    descripcion_pdf, codigo_pdf, cantidad, precio_costo_usd,
    precio_cliente_usd, margen_pct, subtotal_costo_usd,
    subtotal_cliente_usd, orden
  from proforma_lineas
  where proforma_id = p_proforma_id;
end;
$$;

-- Bloquea EXECUTE por default (PostgREST expone toda función public
-- como RPC y Postgres otorga EXECUTE a PUBLIC por default — ver nota
-- de seguridad en la cabecera). Solo el servidor (service_role, vía
-- adminClient en enviar-cliente/route.ts) puede llamarla.
revoke execute on function snapshot_lineas_proforma_enviada(uuid) from public;
grant execute on function snapshot_lineas_proforma_enviada(uuid) to service_role;

-- ══════════════════════════════════════════════════════════════
-- 3. VISTA — comparación por línea (snapshot vs. actual)
-- ══════════════════════════════════════════════════════════════
-- Matching: producto_id+variante_id+componente_id si hay producto_id;
-- si no, fallback por codigo_pdf (mismo criterio que
-- margen_por_categoria_v, migración 029). Dentro de cada match_key se
-- empareja por posición (row_number() partitioned by match_key, order
-- by orden) para resolver codigo_pdf repetido dentro de la misma
-- proforma (ver hallazgo real documentado en la cabecera, proforma
-- 3-0122). `tiene_snapshot` indica si existe algún snapshot real para
-- la proforma — sin esto, una proforma sin snapshot mostraría todas
-- sus líneas como "agregada", lo cual sería engañoso.
create or replace view proforma_lineas_comparacion_v
with (security_invoker = true) as
with snapshot_base as (
  select
    s.*,
    case
      when s.producto_id is not null then
        'id:' || s.producto_id::text
        || '|' || coalesce(s.variante_id::text, '-')
        || '|' || coalesce(s.componente_id::text, '-')
      else 'cod:' || coalesce(s.codigo_pdf, '')
    end as match_key
  from proforma_lineas_snapshot s
  where s.tipo = 'enviada_cliente'
),
snapshot_rn as (
  select
    *,
    row_number() over (
      partition by proforma_id, match_key order by orden, id
    ) as rn
  from snapshot_base
),
actual_base as (
  select
    a.*,
    case
      when a.producto_id is not null then
        'id:' || a.producto_id::text
        || '|' || coalesce(a.variante_id::text, '-')
        || '|' || coalesce(a.componente_id::text, '-')
      else 'cod:' || coalesce(a.codigo_pdf, '')
    end as match_key
  from proforma_lineas a
),
actual_rn as (
  select
    *,
    row_number() over (
      partition by proforma_id, match_key order by orden, id
    ) as rn
  from actual_base
),
con_snapshot as (
  select distinct proforma_id from snapshot_base
)
select
  coalesce(s.proforma_id, a.proforma_id)           as proforma_id,
  coalesce(s.match_key, a.match_key)               as match_key,
  coalesce(s.rn, a.rn)                             as rn,
  exists (
    select 1 from con_snapshot cs
    where cs.proforma_id = coalesce(s.proforma_id, a.proforma_id)
  )                                                 as tiene_snapshot,
  case
    when s.id is not null and a.id is not null then 'coincide'
    when s.id is not null and a.id is null     then 'caida'
    else 'agregada'
  end                                               as estado_linea,
  (
    s.id is not null and a.id is not null and (
      coalesce(s.cantidad, 0)             <> coalesce(a.cantidad, 0)
      or coalesce(s.precio_cliente_usd, 0) <> coalesce(a.precio_cliente_usd, 0)
      or coalesce(s.precio_costo_usd, 0)   <> coalesce(a.precio_costo_usd, 0)
    )
  )                                                 as cambio_detectado,
  s.descripcion_pdf        as snapshot_descripcion_pdf,
  a.descripcion_pdf        as actual_descripcion_pdf,
  s.codigo_pdf              as snapshot_codigo_pdf,
  a.codigo_pdf              as actual_codigo_pdf,
  s.cantidad                as snapshot_cantidad,
  a.cantidad                as actual_cantidad,
  s.precio_costo_usd         as snapshot_precio_costo_usd,
  a.precio_costo_usd         as actual_precio_costo_usd,
  s.precio_cliente_usd       as snapshot_precio_cliente_usd,
  a.precio_cliente_usd       as actual_precio_cliente_usd,
  s.subtotal_costo_usd       as snapshot_subtotal_costo_usd,
  a.subtotal_costo_usd       as actual_subtotal_costo_usd,
  s.subtotal_cliente_usd     as snapshot_subtotal_cliente_usd,
  a.subtotal_cliente_usd     as actual_subtotal_cliente_usd,
  s.created_at               as snapshot_created_at
from snapshot_rn s
full outer join actual_rn a
  on a.proforma_id = s.proforma_id
 and a.match_key   = s.match_key
 and a.rn          = s.rn;

-- ══════════════════════════════════════════════════════════════
-- 4. VISTA — totales por proforma (snapshot vs. actual)
-- ══════════════════════════════════════════════════════════════
create or replace view proforma_totales_comparacion_v
with (security_invoker = true) as
select
  c.proforma_id,
  p.numero,
  p.estado,
  cl.nombre                                            as cliente_nombre,
  bool_or(c.tiene_snapshot)                            as tiene_snapshot,
  sum(coalesce(c.snapshot_subtotal_cliente_usd, 0))    as total_snapshot_cliente_usd,
  sum(coalesce(c.actual_subtotal_cliente_usd, 0))      as total_actual_cliente_usd,
  sum(coalesce(c.snapshot_subtotal_costo_usd, 0))      as total_snapshot_costo_usd,
  sum(coalesce(c.actual_subtotal_costo_usd, 0))        as total_actual_costo_usd,
  count(*) filter (where c.estado_linea = 'coincide')                          as n_lineas_coinciden,
  count(*) filter (where c.estado_linea = 'coincide' and c.cambio_detectado)   as n_lineas_con_cambio,
  count(*) filter (where c.estado_linea = 'caida')                            as n_lineas_caidas,
  count(*) filter (where c.estado_linea = 'agregada')                         as n_lineas_agregadas
from proforma_lineas_comparacion_v c
join proformas p on p.id = c.proforma_id
left join clientes cl on cl.id = p.cliente_id
group by c.proforma_id, p.numero, p.estado, cl.nombre;
-- ══════════════════════════════════════════════════════════════
