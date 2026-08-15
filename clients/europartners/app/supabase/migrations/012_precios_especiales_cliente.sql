-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 012 — Precios especiales por cliente
-- Incremental, no destructiva — ver nota en migración 001.
--
-- Pedido por Deisy (2026-08-13, tras el hallazgo de TZ-59L el 12-ago):
-- hoy el precio de un producto solo se resuelve a nivel de tipo
-- (mayorista/detallista, productos.precio_mayorista/precio_detallista),
-- igual para los 5+ clientes de ese tipo. No existe forma de fijar un
-- precio distinto para UN cliente puntual en UN producto puntual sin
-- tocar el catálogo global (que afectaría a todos los demás clientes
-- de ese tipo). Esta tabla permite eso: un override por (cliente,
-- producto) que se resuelve ANTES que el precio de catálogo, tanto en
-- el link de autoservicio del cliente (/solicitud/[token]) como en el
-- cotizador manual de Deisy.
--
-- componente_id nullable: previsto para Hardware & Lumber (modo_pricing
-- = 'componente', factura por TANK/BOWL/SEATCOVER en vez de por set),
-- pero el alcance inicial de esta migración solo resuelve overrides a
-- nivel de producto completo (suficiente para el caso real que motivó
-- esto, TZ-59L, que se vende como código único). Dejar la columna lista
-- evita otra migración después si se necesita el nivel componente.
-- ══════════════════════════════════════════════════════════════

create table if not exists precios_especiales_cliente (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid references clientes(id) on delete cascade not null,
  producto_id  uuid references productos(id) on delete cascade not null,
  componente_id uuid references producto_componentes(id) on delete cascade,
  precio_usd   numeric(12,4) not null check (precio_usd > 0),
  motivo       text,
  activo       boolean not null default true,
  creado_por   uuid references usuarios(id),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Solo un override activo a la vez por (cliente, producto, componente) —
-- fijar uno nuevo primero desactiva el anterior (ver POST del endpoint),
-- así queda historial completo en la tabla en vez de sobreescribir.
create unique index if not exists idx_precios_especiales_activo_unico
  on precios_especiales_cliente (cliente_id, producto_id, coalesce(componente_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where activo;

create index if not exists idx_precios_especiales_cliente on precios_especiales_cliente(cliente_id) where activo;
create index if not exists idx_precios_especiales_producto on precios_especiales_cliente(producto_id) where activo;

alter table precios_especiales_cliente enable row level security;

create policy "read_auth" on precios_especiales_cliente for select using (auth.role() = 'authenticated');
create policy "service_all" on precios_especiales_cliente for all using (auth.role() = 'service_role');
