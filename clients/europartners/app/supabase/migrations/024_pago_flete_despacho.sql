-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 024 — Pago de flete (cliente) ligado a `despachos`
-- Incremental, no destructiva — ver nota en migración 001.
--
-- Gap encontrado en el Registro Maestro Vivo: "FLETE PAGADO" (lo que el
-- cliente paga por el flete/shipping de su embarque) no existe hoy en
-- ningún lado de la base — `despachos.shipping_fee_usd` (schema_v2.sql)
-- es un campo manual, numérico, sin ningún comprobante ni registro de
-- cobro asociado: Deisy/Marta lo cargan a mano y ahí muere.
--
-- Decisión explícita de Jero (2026-09-08): el pago de flete "es un pago
-- que realiza el cliente y en mi opinión debería ir ligado a los
-- despachos, de tal manera que podamos registrar el pago del cliente, o
-- mediante una confirmación de pago, o un link donde el cliente registre
-- el pago con los comprobantes". Es decir: reusar exactamente el mismo
-- patrón que ya existe para el pago de la factura (tabla `pagos`, botón
-- manual, link público con comprobante) pero ligado al DESPACHO en vez
-- de solo a la proforma en general.
--
-- IMPORTANTE — esto NO es "FLETE CHINA PAGADO" (lo que Europartners le
-- paga a la naviera del lado de China, ya cubierto conceptualmente por
-- `pagos.tipo='china'` a nivel de proforma). Es un concepto distinto y
-- queda pendiente para otra conversación — esta migración solo cubre el
-- flete que el CLIENTE paga a Europartners por su propio embarque.
-- ══════════════════════════════════════════════════════════════

-- ── `pagos.despacho_id` ──────────────────────────────────────────
-- Nullable a propósito: los pagos tipo='cliente' y tipo='china' que ya
-- existen (y los que se sigan creando desde el cotizador/proforma) NO
-- están ligados a un despacho — solo a la proforma. Un pago tipo='flete'
-- SIEMPRE debería traer despacho_id (se valida en el código de los
-- endpoints, no acá con NOT NULL, porque el mismo patrón de este repo —
-- ver 021_tabla_pagos.sql — deja las reglas de negocio finas en la capa
-- de API y usa la base solo para la integridad referencial).
--
-- No se agrega on delete cascade: un despacho no debería borrarse nunca
-- en la práctica (no hay ningún endpoint DELETE /api/despachos/[id] en
-- este repo), así que se deja sin acción explícita (default RESTRICT)
-- para que, si algún día se agrega un borrado de despachos, falle fuerte
-- en vez de dejar pagos históricos con despacho_id colgando de la nada.
alter table pagos
  add column if not exists despacho_id uuid references despachos(id);

create index if not exists idx_pagos_despacho on pagos(despacho_id);

-- ── `pagos.tipo` — agregar 'flete' al check constraint ───────────
-- El constraint original (021_tabla_pagos.sql) solo permitía
-- ('cliente', 'china'). Postgres no tiene "alter check constraint", hay
-- que borrar y recrear. Se usa el nombre por default que le puso
-- Postgres a la constraint original (`pagos_tipo_check`, generado a
-- partir de `check (tipo in (...))` sin nombre explícito) — confirmado
-- que es ese nombre porque 021 no le puso ningún nombre custom.
alter table pagos drop constraint if exists pagos_tipo_check;
alter table pagos add constraint pagos_tipo_check
  check (tipo in ('cliente', 'china', 'flete'));

-- ── Trigger `recalcular_estado_pago_proforma` — SIN CAMBIOS ──────
-- Se revisó a fondo el trigger de 021_tabla_pagos.sql antes de tocar
-- nada acá: la suma que alimenta `proformas.estado_pago` ya filtra
-- EXPLÍCITAMENTE `where tipo = 'cliente'` (no "where tipo <> 'china'" ni
-- ninguna otra forma implícita que hubiera colado 'flete' sin querer):
--
--   select coalesce(sum(monto), 0) into v_pagado_cliente
--     from pagos
--     where proforma_id = v_proforma_id
--       and tipo = 'cliente';
--
-- Por lo tanto un pago tipo='flete' NO suma hacia estado_pago de la
-- proforma — que es exactamente lo que se necesita: el flete es un
-- concepto separado del total facturado de la proforma (total_cif_usd /
-- total_fob_usd), y mezclarlo ahí infabilizaría "proforma pagada" con
-- dinero que en realidad corresponde a shipping, no a mercancía. No se
-- modifica la función ni el trigger en esta migración — ya estaban bien
-- desde el día uno de 021.
--
-- Mismo razonamiento aplica a la vista `proformas_deuda_vivo` (021): su
-- CTE `pc` (pagado cliente) también filtra `where tipo = 'cliente'`, así
-- que `deuda_cliente_usd` tampoco se ve afectada por pagos de flete. No
-- se toca esa vista en esta migración.
-- ══════════════════════════════════════════════════════════════
