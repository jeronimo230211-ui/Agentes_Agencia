-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 029 — Vistas para el panel "Indicadores Estratégicos" (/indicadores)
-- Incremental, no destructiva — ver nota en migración 001.
-- 100% aditiva: NO crea tablas, NO agrega columnas, NO toca datos ni
-- vistas existentes. Solo agrega 4 vistas de SOLO LECTURA.
--
-- ── Qué hace ──────────────────────────────────────────────────────
-- Crea las vistas que necesita el nuevo panel /indicadores (KPIs ya
-- definidos por data-analyst, diseño ya aprobado por ui-ux-designer):
--   1. concentracion_clientes_v   — % de facturación por cliente
--      concentracion_paises_v    — % de facturación por país
--   2. rentabilidad_por_cliente_v — margen ponderado real por cliente
--   3. margen_por_categoria_v     — margen ponderado por categoría de producto
--   4. catalogo_desactualizado_rechazos_v — proformas rechazadas por
--      motivo de precio/catálogo desactualizado
--
-- ── Por qué ───────────────────────────────────────────────────────
-- Marta necesita ver, sin pedirle un reporte a nadie, qué tan
-- concentrado está el negocio en pocos clientes/países, qué tan
-- rentable es cada cliente y categoría de verdad (no en la cotización,
-- sino en lo que ya se aprobó y se vendió), y si el catálogo
-- desactualizado está costando ventas.
--
-- ── Criterio de "facturación real" (vistas 1) ────────────────────
-- Se usa el MISMO criterio que ya usa la app en dos lugares (no se
-- inventa uno nuevo): app/api/dashboard/stats/route.ts línea ~31 y
-- app/api/finanzas/route.ts línea ~135 — proformas con
-- estado IN ('enviada', 'facturada'), monto = coalesce(total_cif_usd,
-- total_fob_usd, 0) (mismo fallback que usa el trigger de pagos de la
-- migración 021 y el endpoint de pago por token).
--
-- ── Fórmula de margen (vistas 2 y 3) ──────────────────────────────
-- Se usa la MISMA fórmula que ya usa la app (lib/precio.ts,
-- calcMargen): margen = (precio_cliente_usd / precio_costo_usd) - 1
-- (markup sobre costo — consistente con clientes.margen_min/margen_max,
-- que son porcentajes de markup sobre costo, y con calcPrecioCliente
-- que multiplica el costo por (1 + margen)). NO se usa la columna
-- historial_precios.margen_pct ya guardada: se recalcula desde
-- precio_costo_usd/precio_cliente_usd porque esa columna puede venir
-- null o desactualizada en líneas viejas (ver lib/historialPrecios.ts
-- y app/(app)/cotizador/[id]/page.tsx línea 782, que a veces guarda
-- margen_pct: undefined). Solo se consideran líneas con
-- precio_costo_usd y precio_cliente_usd no nulos y precio_costo_usd > 0.
--
-- "Margen ponderado por precio_cliente_usd" = cada línea pesa según su
-- valor de venta, no todas las líneas pesan igual (una línea de
-- USD 5,000 no debe pesar lo mismo que una de USD 50):
--   margen_ponderado = sum(margen_linea * precio_cliente_usd)
--                      / sum(precio_cliente_usd)
--
-- ── Verificado contra datos reales (solo lectura, 2026-11-05) ─────
-- Resultado simulado (misma lógica, corrida con supabase-js/service
-- key antes de escribir esta migración) coincide con lo reportado por
-- data-analyst: top 1 cliente (Hardware & Lumber) 38.71% de la
-- facturación real, Jamaica 100% (hoy NINGÚN cliente de Aruba/México/
-- Panamá/Trinidad y Tobago tiene proformas en estado enviada/facturada
-- todavía — por eso no es exactamente igual al ~99.8% que pudo haber
-- visto data-analyst en otro corte de datos, pero la conclusión —
-- concentración casi total en Jamaica — es la misma).
--
-- ── Dos huecos de datos reales, no bugs de esta migración ─────────
-- (a) VOLUMEN: `historial_precios` NO tiene columna `cantidad` (se
--     revisó el esquema completo, schema_v2.sql y las 28 migraciones:
--     nunca se agregó). margen_por_categoria_v NO incluye volumen por
--     esta razón — no se inventa ni se aproxima desde otra tabla
--     (proforma_lineas.cantidad existe, pero esa tabla no tiene FK
--     hacia historial_precios, así que no hay forma confiable de
--     cruzarlas línea a línea). Si Jero/Marta quieren volumen real por
--     categoría, hay que agregar `cantidad` a `historial_precios` en
--     una migración futura y poblarla desde ahora en
--     lib/historialPrecios.ts — no se puede backfillear retroactivo de
--     forma confiable.
-- (b) COBERTURA DEL CRUCE A CATEGORÍA: de las 1000 filas reales de
--     historial_precios, solo 53 tienen producto_id. El fallback por
--     codigo_pdf = productos.codigo recupera 221 más. Quedan 726 (72.6%)
--     sin categoría asignable — probablemente códigos de líneas viejas
--     que ya no coinciden con el código actual del producto tras alguna
--     reestructuración del catálogo. margen_por_categoria_v NO esconde
--     este hueco: esas líneas caen en la fila
--     categoria_nombre = 'Sin categoría / producto no identificado',
--     visible y con su propia cobertura — así el frontend puede avisar
--     "basado en el Y% de las líneas" en vez de mostrar un número que
--     parece completo y no lo es. Si se quiere mejorar la cobertura,
--     es trabajo de data-pipeline-engineer (cruce adicional por
--     descripcion_pdf o backfill manual de producto_id en
--     historial_precios), no de esta migración.
--
-- ── catalogo_desactualizado_rechazos_v — limitación conocida ──────
-- `productos.precio_fob_fecha` es la fecha ACTUAL del costo FOB del
-- producto (no se historiza por proforma en ningún lado del esquema).
-- Si el precio del producto se actualizó DESPUÉS del rechazo, esta
-- vista muestra la fecha de actualización actual, no la que tenía el
-- producto en el momento exacto del rechazo. Es la única fecha
-- disponible en el esquema para esto — se documenta la limitación en
-- vez de inventar una historización que no existe. Hoy solo hay 4
-- proformas rechazadas en toda la base, todas con motivo de precio
-- ("desactualizacion de precios", "revisar el precio", etc.) — el
-- frontend filtra sobre motivo_rechazo (texto libre), esta vista no
-- filtra nada, solo expone los datos crudos cruzados.
--
-- ── Seguridad / RLS ────────────────────────────────────────────────
-- Las 4 vistas se crean con `security_invoker = true` (mismo fix que
-- la migración 023 le aplicó a proformas_deuda_vivo, por la misma
-- razón: sin esto, una vista corre con los permisos de quien la CREÓ
-- —bypassa RLS— en vez de quien la CONSULTA). Con security_invoker,
-- heredan exactamente las policies de las tablas base que usan
-- (clientes, proformas, historial_precios, productos,
-- categorias_producto, proforma_lineas) — TODAS ya tienen el patrón
-- estándar de este repo: "read_auth" (solo authenticated) +
-- "service_all" (solo service_role). anon sigue sin ver nada. No se
-- agrega ningún GRANT: Supabase ya da los privilegios default de
-- schema public a anon/authenticated/service_role a nivel de proyecto
-- (igual que el resto de vistas/tablas de este repo, que tampoco traen
-- GRANT explícito).
--
-- ── Índices ────────────────────────────────────────────────────────
-- No se crea ningún índice nuevo. Los filtros de estas vistas ya están
-- cubiertos por índices existentes: idx_proformas_estado,
-- idx_proformas_cliente (vistas 1), idx_historial_cliente,
-- idx_historial_codigo (vistas 2 y 3), idx_productos_codigo (vista 3).
--
-- ── Impacto en la app ──────────────────────────────────────────────
-- Ninguno sobre lo existente. Es la base de datos para un endpoint
-- nuevo (p.ej. /api/indicadores) y la página nueva /indicadores que
-- construye agency-developer. Las vistas se consultan igual que
-- cualquier tabla (`.from('concentracion_clientes_v').select('*')`),
-- con el cliente de servidor (service_role, bypassa RLS, igual que el
-- resto de endpoints de este repo) o con sesión de usuario autenticado.
--
-- ── Cómo verificar (Jerónimo, en el SQL Editor de Supabase) ───────
-- Después de correr esta migración, correr estas 4 queries y comparar
-- contra los ejemplos reales de abajo (capturados en producción antes
-- de escribir la migración, con la misma lógica vía supabase-js):
--
--   select * from concentracion_clientes_v order by pct_del_total desc;
--     -- esperado: Hardware & Lumber primero, pct_del_total ≈ 38.71
--   select * from concentracion_paises_v order by pct_del_total desc;
--     -- esperado: Jamaica, pct_del_total = 100 (hoy no hay facturación
--     -- real todavía en Aruba/México/Panamá/Trinidad y Tobago)
--   select * from rentabilidad_por_cliente_v order by n_lineas_total desc;
--     -- esperado: HJB Jamaica con margen_ponderado_pct ≈ 14.97,
--     -- cobertura 375/376; Hardware & Lumber ≈ 23.82, cobertura 250/250
--   select * from margen_por_categoria_v order by n_lineas_total desc;
--     -- esperado: 'Sin categoría / producto no identificado' primero
--     -- (726 líneas), luego 'Toilets' (margen ≈ 16.72, 157/160),
--     -- 'Toilet Parts' (margen ≈ 95.93, 38/38 — revisar si ese número
--     -- es real o un dato sucio, es un margen fuera de rango normal)
--   select * from catalogo_desactualizado_rechazos_v;
--     -- esperado: 4 filas (proformas 3-0018, 3-0017, 3-0241, 3-0038)
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- 1. CONCENTRACIÓN DE CLIENTES Y PAÍSES
-- ══════════════════════════════════════════════════════════════
create or replace view concentracion_clientes_v
with (security_invoker = true) as
with por_cliente as (
  select
    c.id      as cliente_id,
    c.nombre  as cliente_nombre,
    c.pais,
    coalesce(sum(coalesce(p.total_cif_usd, p.total_fob_usd, 0)), 0) as total_usd
  from clientes c
  left join proformas p
    on p.cliente_id = c.id
   and p.estado in ('enviada', 'facturada')
  group by c.id, c.nombre, c.pais
)
select
  cliente_id,
  cliente_nombre,
  pais,
  total_usd,
  case when sum(total_usd) over () > 0
    then round(total_usd / sum(total_usd) over () * 100, 2)
    else 0
  end as pct_del_total
from por_cliente;

create or replace view concentracion_paises_v
with (security_invoker = true) as
with por_pais as (
  select
    coalesce(c.pais, 'Sin país') as pais,
    coalesce(sum(coalesce(p.total_cif_usd, p.total_fob_usd, 0)), 0) as total_usd
  from clientes c
  left join proformas p
    on p.cliente_id = c.id
   and p.estado in ('enviada', 'facturada')
  group by c.pais
)
select
  pais,
  total_usd,
  case when sum(total_usd) over () > 0
    then round(total_usd / sum(total_usd) over () * 100, 2)
    else 0
  end as pct_del_total
from por_pais;

-- ══════════════════════════════════════════════════════════════
-- 2. RENTABILIDAD REAL POR CLIENTE (desde historial_precios)
-- ══════════════════════════════════════════════════════════════
create or replace view rentabilidad_por_cliente_v
with (security_invoker = true) as
with base as (
  select
    cliente_id,
    case
      when precio_costo_usd is not null and precio_cliente_usd is not null and precio_costo_usd > 0
      then ((precio_cliente_usd / precio_costo_usd) - 1) * precio_cliente_usd
      else 0
    end as numerador,
    case
      when precio_costo_usd is not null and precio_cliente_usd is not null and precio_costo_usd > 0
      then precio_cliente_usd
      else 0
    end as denominador,
    (precio_costo_usd is not null and precio_cliente_usd is not null and precio_costo_usd > 0) as con_margen
  from historial_precios
),
agregado as (
  select
    cliente_id,
    sum(numerador)                             as numerador,
    sum(denominador)                           as denominador,
    count(*) filter (where con_margen)         as n_lineas_con_margen,
    count(*)                                   as n_lineas_total
  from base
  group by cliente_id
)
select
  c.id      as cliente_id,
  c.nombre  as cliente_nombre,
  c.margen_min,
  c.margen_max,
  case when a.denominador > 0
    then round(a.numerador / a.denominador * 100, 2)
    else null
  end as margen_ponderado_pct,
  coalesce(a.n_lineas_con_margen, 0) as n_lineas_con_margen,
  coalesce(a.n_lineas_total, 0)      as n_lineas_total
from clientes c
left join agregado a on a.cliente_id = c.id;

-- ══════════════════════════════════════════════════════════════
-- 3. MARGEN REAL POR CATEGORÍA DE PRODUCTO (desde historial_precios)
-- ══════════════════════════════════════════════════════════════
-- Resolución de categoría: producto_id si existe; si no, fallback por
-- codigo_pdf = productos.codigo (ver nota de cobertura arriba). No se
-- incluye volumen (sum(cantidad)): historial_precios no tiene esa
-- columna (ver nota arriba).
create or replace view margen_por_categoria_v
with (security_invoker = true) as
with lineas as (
  select
    hp.precio_costo_usd,
    hp.precio_cliente_usd,
    coalesce(p_id.categoria_id, p_codigo.categoria_id) as categoria_id
  from historial_precios hp
  left join productos p_id
    on p_id.id = hp.producto_id
  left join productos p_codigo
    on hp.producto_id is null
   and p_codigo.codigo = hp.codigo_pdf
),
agregado as (
  select
    categoria_id,
    sum(
      case when precio_costo_usd is not null and precio_cliente_usd is not null and precio_costo_usd > 0
        then ((precio_cliente_usd / precio_costo_usd) - 1) * precio_cliente_usd
        else 0
      end
    ) as numerador,
    sum(
      case when precio_costo_usd is not null and precio_cliente_usd is not null and precio_costo_usd > 0
        then precio_cliente_usd
        else 0
      end
    ) as denominador,
    count(*) filter (
      where precio_costo_usd is not null and precio_cliente_usd is not null and precio_costo_usd > 0
    ) as n_lineas_con_margen,
    count(*) as n_lineas_total
  from lineas
  group by categoria_id
)
select
  cat.id as categoria_id,
  coalesce(cat.nombre, 'Sin categoría / producto no identificado') as categoria_nombre,
  case when a.denominador > 0
    then round(a.numerador / a.denominador * 100, 2)
    else null
  end as margen_ponderado_pct,
  a.n_lineas_con_margen,
  a.n_lineas_total
from agregado a
left join categorias_producto cat on cat.id = a.categoria_id;

-- ══════════════════════════════════════════════════════════════
-- 4. RECHAZOS POR CATÁLOGO/PRECIO DESACTUALIZADO
-- ══════════════════════════════════════════════════════════════
-- No filtra por texto de motivo_rechazo a propósito (es texto libre,
-- sin un patrón consistente hoy — "desactualizacion de precios",
-- "revisar el precio mas bajo...", "Revisar") — se expone crudo y el
-- frontend decide el filtro/resaltado. Ver limitación de
-- precio_fob_fecha (no historizado) en la nota de arriba.
create or replace view catalogo_desactualizado_rechazos_v
with (security_invoker = true) as
select
  p.id                                as proforma_id,
  p.numero,
  p.fecha                             as fecha_rechazo,
  p.cliente_id,
  c.nombre                            as cliente_nombre,
  p.motivo_rechazo,
  count(pl.id)                        as n_lineas,
  min(pr.precio_fob_fecha)            as precio_fob_fecha_mas_antigua,
  max(pr.precio_fob_fecha)            as precio_fob_fecha_mas_reciente,
  max(p.fecha - pr.precio_fob_fecha)  as dias_desde_actualizacion_precio_max
from proformas p
join clientes c on c.id = p.cliente_id
left join proforma_lineas pl on pl.proforma_id = p.id
left join productos pr on pr.id = pl.producto_id
where p.estado = 'rechazada'
group by p.id, p.numero, p.fecha, p.cliente_id, c.nombre, p.motivo_rechazo;
