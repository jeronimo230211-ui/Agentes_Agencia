-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 021 — Tabla `pagos` (Registro Maestro Vivo, Fase 1)
-- Incremental, no destructiva — ver nota en migración 001.
--
-- Reemplaza el modelo actual de "un solo pago por proforma" (columnas
-- escalares monto_abono_recibido/fecha_abono/comprobante_url en
-- `proformas`, que se SOBREESCRIBEN cada vez que el cliente sube un
-- comprobante nuevo — ver POST /api/pago/[token]/route.ts) por una
-- tabla `pagos` con historial completo: N filas por proforma, tanto de
-- cobro al cliente (tipo='cliente') como de pago al proveedor en China
-- (tipo='china', funcionalidad nueva — hoy no existe nada de esto).
--
-- Las columnas viejas de `proformas` (monto_abono_requerido,
-- monto_abono_recibido, fecha_abono, comprobante_url) NO se tocan ni
-- se borran en esta migración — quedan muertas pero inofensivas hasta
-- que Fase 2 migre los endpoints a leer/escribir `pagos`. Tampoco se
-- hace backfill de proformas ya pagadas con el modelo viejo: una
-- proforma que hoy tiene estado_pago='pagado' sin filas en `pagos`
-- mantiene ese estado (el trigger de abajo solo actúa cuando cambian
-- filas de `pagos`) hasta que alguien cargue su historial real o Jero
-- decida cómo migrar los datos existentes.
--
-- `proformas.estado_pago` pasa a calcularse SOLO por trigger a partir
-- de `pagos` — el botón "Confirmar pago recibido" y su endpoint
-- /api/proformas/[id]/confirmar-pago/route.ts (que hoy hace un UPDATE
-- directo a estado_pago sin verificar montos) quedan obsoletos. Esta
-- migración no los borra (es tarea de Fase 2 en el código), pero desde
-- que se aplique, cualquier UPDATE manual de estado_pago que no pase
-- por `pagos` puede quedar pisado en el próximo INSERT/UPDATE/DELETE
-- sobre `pagos` de esa proforma.
--
-- Confirmado con Jero: la RLS de `pagos` (read_auth + service_all, ver
-- abajo) se queda tal cual, sin distinción de rol a nivel de base de
-- datos — es el mismo patrón que ya usa el resto del schema.
-- ══════════════════════════════════════════════════════════════

-- ── Tabla de pagos (historial completo, cliente y China) ────────
create table if not exists pagos (
  id                 uuid primary key default gen_random_uuid(),
  proforma_id        uuid references proformas(id) not null,
  tipo               text not null check (tipo in ('cliente', 'china')),
  monto              numeric(12,2) not null check (monto > 0),
  comision_bancaria  numeric(12,2) default 0,
  referencia         text,
  comprobante_url    text,
  fecha              date not null default current_date,
  -- Quién lo registró. Nullable a propósito: cuando el cliente sube su
  -- comprobante vía POST /api/pago/[token] no hay sesión (mismo caso que
  -- `tokens_pago`/`solicitudes` con acceso público por token) — ese
  -- endpoint, en Fase 2, insertará acá usando createAdminClient() y
  -- dejará registrado_por en null. Cuando lo carga Deisy/Marta desde el
  -- cotizador sí queda su usuarios.id.
  registrado_por     uuid references usuarios(id),
  nota               text,
  created_at         timestamptz not null default now()
);

create index if not exists idx_pagos_proforma on pagos(proforma_id);
create index if not exists idx_pagos_tipo     on pagos(tipo);

-- Comprobante de cada pago: mismo bucket `documentos` y misma carpeta
-- `comprobantes/` que usa hoy POST /api/pago/[token], pero el nombre de
-- archivo pasa a incluir el id del pago en vez de solo proforma+timestamp
-- (ej. `comprobantes/{pagoId}.{ext}`) para que cada fila tenga su propio
-- comprobante sin pisar el anterior. Se implementa en Fase 2 (código),
-- acá solo se deja la columna.

-- ── Campos nuevos de `proformas` (plan Registro Maestro Vivo) ───
alter table proformas
  add column if not exists perdida_usd          numeric(12,2),
  add column if not exists motivo_perdida        text,
  add column if not exists nota_credito_usd      numeric(12,2),
  add column if not exists motivo_nota_credito   text,
  add column if not exists acuerdo_pago          text,
  -- Total facturado por el proveedor chino para ESTA proforma/embarque.
  -- Investigado a fondo (017_modulo_emily.sql, api/emily/[token]/route.ts,
  -- api/proformas-china/[id]/revisar/route.ts): el módulo Emily NO tiene
  -- ninguna relación con `proformas`. `proformas_china` no tiene columna
  -- `proforma_id` — solo `colaborador_id` (Emily) — y sus líneas
  -- (`proformas_china_lineas`) son propuestas de PRECIO DE CATÁLOGO por
  -- producto (precio_fob_propuesto), no un cargo de un embarque puntual:
  -- al aprobar una línea, el único efecto es
  -- `update productos set precio_fob_usd = precio_fob_propuesto`
  -- (ver revisar/route.ts línea 60-63, y su propio comentario: "Piloto:
  -- solo actualiza el costo del catálogo, no genera automático un
  -- borrador de proforma cliente"). No existe ningún campo de cantidad
  -- ni de línea que quede atado a un `proformas.id` — así que no hay
  -- forma de derivar en vivo "cuánto se le debe a China por ESTA
  -- proforma" a partir de `proformas_china_lineas`. Por eso queda como
  -- campo manual, nullable, sin trigger que lo calcule ni lo fuerce —
  -- Deisy/Marta lo cargan a mano (Fase 2) con el monto real de la
  -- factura/PI de China para ese embarque.
  add column if not exists total_china_usd      numeric(12,2);

-- ── Trigger: estado_pago se recalcula SOLO desde `pagos` ─────────
-- Total facturado al cliente: `proformas` NO tiene una columna única
-- "total_cliente_usd". El flujo de pago actual (GET /api/pago/[token])
-- usa `total_cif_usd || total_fob_usd || 0` como "el total que ve el
-- cliente" — se replica exactamente esa misma resolución acá para no
-- introducir un criterio nuevo.
create or replace function recalcular_estado_pago_proforma()
returns trigger
language plpgsql
as $$
declare
  v_proforma_id     uuid := coalesce(new.proforma_id, old.proforma_id);
  v_total_facturado numeric;
  v_pagado_cliente  numeric;
begin
  select coalesce(total_cif_usd, total_fob_usd, 0)
    into v_total_facturado
    from proformas
    where id = v_proforma_id;

  select coalesce(sum(monto), 0)
    into v_pagado_cliente
    from pagos
    where proforma_id = v_proforma_id
      and tipo = 'cliente';

  update proformas
     set estado_pago = case
                          when v_total_facturado > 0 and v_pagado_cliente >= v_total_facturado then 'pagado'
                          when v_pagado_cliente > 0 then 'parcial'
                          else 'pendiente'
                        end,
         updated_at = now()
   where id = v_proforma_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_recalcular_estado_pago on pagos;
create trigger trg_recalcular_estado_pago
  after insert or update or delete on pagos
  for each row execute function recalcular_estado_pago_proforma();

-- Nota Hardware & Lumber (slug 'hl'): ese cliente nunca recibe token de
-- pago y por lo tanto nunca tendrá filas en `pagos` tipo='cliente' — el
-- trigger de arriba lo deja en estado_pago='pendiente' para siempre, IGUAL
-- que hoy. No rompe nada: POST /api/despachos/route.ts ya chequea el slug
-- del cliente aparte (`esHL`) y salta la validación de estado_pago para
-- ese caso puntual (líneas ~56-58 de ese archivo) — sigue funcionando sin
-- cambios.

-- ── Vista: deuda en vivo por proforma ─────────────────────────────
create or replace view proformas_deuda_vivo as
select
  p.id                                                as proforma_id,
  p.numero,
  coalesce(p.total_cif_usd, p.total_fob_usd, 0)        as total_facturado_cliente_usd,
  coalesce(pc.pagado, 0)                               as pagado_cliente_usd,
  coalesce(p.total_cif_usd, p.total_fob_usd, 0)
    - coalesce(pc.pagado, 0)                           as deuda_cliente_usd,
  coalesce(pch.pagado, 0)                              as pagado_china_usd,
  -- `total_china_usd` es un campo manual (ver alter table de arriba):
  -- el módulo Emily no queda atado a ninguna proforma puntual, así que
  -- no hay forma de derivar este total en vivo desde
  -- `proformas_china_lineas` — se resta contra lo que Deisy/Marta hayan
  -- cargado a mano. Si `total_china_usd` es null, la deuda también
  -- queda null (embarque sin monto de China cargado todavía).
  p.total_china_usd - coalesce(pch.pagado, 0)          as deuda_china_usd
from proformas p
left join (
  select proforma_id, sum(monto) as pagado
  from pagos
  where tipo = 'cliente'
  group by proforma_id
) pc on pc.proforma_id = p.id
left join (
  select proforma_id, sum(monto) as pagado
  from pagos
  where tipo = 'china'
  group by proforma_id
) pch on pch.proforma_id = p.id;

-- ── RLS ────────────────────────────────────────────────────────
-- Mismo patrón que TODAS las demás tablas con RLS de este schema
-- (solicitudes, precios_especiales_cliente, proformas_china,
-- colaboradores_externos — ver migraciones 001/012/017): "read_auth"
-- para cualquier usuario autenticado + "service_all" para service_role.
--
-- Este repo NO tiene, en ninguna tabla existente, políticas RLS que
-- distingan roles de negocio (operaciones/admin/analista/diseñadora).
-- Esa distinción se hace siempre en el código de cada API route (ej.
-- confirmar-pago/route.ts: `if (!['operaciones','admin'].includes(usuario.rol))`)
-- usando el cliente con sesión (createRouteHandlerClient) SOLO para leer
-- `usuarios.rol`; el INSERT/UPDATE real siempre se hace después con
-- createAdminClient() (service_role), que es el único rol con permiso de
-- escritura a nivel de RLS (confirmado también en
-- app/api/pago/[token]/route.ts y app/lib/supabase-server.ts, y en cómo
-- escriben app/api/solicitudes/[id]/route.ts y
-- app/api/clientes/[id]/precios-especiales/route.ts sobre sus propias
-- tablas con RLS). Se sigue exactamente ese mismo patrón acá: la
-- restricción operaciones/admin para pagos tipo='china', y
-- operaciones/admin para pagos tipo='cliente' cargados a mano, se
-- implementa en los endpoints de Fase 2, no en RLS.
alter table pagos enable row level security;

create policy "read_auth" on pagos for select using (auth.role() = 'authenticated');
create policy "service_all" on pagos for all using (auth.role() = 'service_role');
