-- ============================================================
-- EUROPARTNERS — Sistema de Operaciones
-- Schema v2.0 — Reset + Rediseño completo
-- Fecha: 2026-07-04
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ── 1. LIMPIAR SCHEMA ANTERIOR ────────────────────────────────
drop table if exists notificaciones          cascade;
drop table if exists tokens_aprobacion       cascade;
drop table if exists proforma_eventos        cascade;
drop table if exists historial_precios       cascade;
drop table if exists proforma_lineas         cascade;
drop table if exists proformas               cascade;
drop table if exists sku_clientes            cascade;
drop table if exists despachos               cascade;
drop table if exists producto_componentes    cascade;
drop table if exists producto_variantes      cascade;
drop table if exists productos               cascade;
drop table if exists categorias_producto     cascade;
drop table if exists parametros_precio       cascade;
drop table if exists clientes                cascade;
drop table if exists usuarios                cascade;
drop sequence if exists proforma_numero_seq  cascade;
drop function if exists generar_numero_proforma cascade;

-- ── 2. EXTENSIONES ────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ══════════════════════════════════════════════════════════════
-- USUARIOS
-- ══════════════════════════════════════════════════════════════
create table usuarios (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  rol        text not null check (rol in ('operaciones', 'admin')),
  activo     boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ══════════════════════════════════════════════════════════════
-- CLIENTES — con segmentación mayorista/detallista
-- ══════════════════════════════════════════════════════════════
create table clientes (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  slug              text unique not null,
  tipo              text not null default 'mayorista'
                    check (tipo in ('mayorista', 'detallista')),
  margen_min        numeric(5,2) not null default 10,
  margen_max        numeric(5,2) not null default 12,
  pais              text default 'Jamaica',
  ciudad            text,
  contacto_nombre   text,
  contacto_email    text,
  contacto_telefono text,
  incoterm          text not null default 'FOB'
                    check (incoterm in ('FOB','CFR','CIF')),
  modo_pricing      text not null default 'set'
                    check (modo_pricing in ('set','componente')),
  issuer_pdf        text default 'Europartners International',
  notas             text,
  activo            boolean default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ══════════════════════════════════════════════════════════════
-- TRADUCCIÓN DE SKU — para cliente con códigos propios
-- ══════════════════════════════════════════════════════════════
create table sku_clientes (
  id                   uuid primary key default gen_random_uuid(),
  cliente_id           uuid references clientes(id) on delete cascade not null,
  sku_cliente          text not null,
  codigo_europartners  text not null,
  descripcion_cliente  text,
  notas                text,
  activo               boolean default true,
  created_at           timestamptz default now(),
  unique(cliente_id, sku_cliente)
);

-- ══════════════════════════════════════════════════════════════
-- CATÁLOGO DE PRODUCTOS
-- ══════════════════════════════════════════════════════════════
create table categorias_producto (
  id     uuid primary key default gen_random_uuid(),
  nombre text unique not null,
  orden  int default 0
);

create table productos (
  id              uuid primary key default gen_random_uuid(),
  categoria_id    uuid references categorias_producto(id),
  codigo          text unique not null,
  nombre          text not null,
  descripcion     text,
  proveedor       text default 'Tangshan Ceramic Corp',
  -- Dimensiones: { largo_cm, ancho_cm, alto_cm, peso_kg, cbm_unitario }
  dimensiones     jsonb,
  -- Imágenes
  imagen_url      text,
  imagenes_urls   text[],
  -- Precio de referencia base (costo Emily más reciente)
  precio_fob_usd  numeric(12,4),
  precio_fob_fecha date,
  -- Estado
  estado          text default 'activo'
                  check (estado in ('activo','descontinuado','pendiente')),
  notas           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table producto_variantes (
  id              uuid primary key default gen_random_uuid(),
  producto_id     uuid references productos(id) on delete cascade not null,
  variante        text not null,
  codigo_variante text,
  precio_fob_usd  numeric(12,4),
  cbm_unitario    numeric(8,4),
  activo          boolean default true,
  unique(producto_id, variante)
);

create table producto_componentes (
  id             uuid primary key default gen_random_uuid(),
  producto_id    uuid references productos(id) on delete cascade not null,
  componente     text not null,
  precio_fob_usd numeric(12,4),
  orden          int default 0
);

-- ══════════════════════════════════════════════════════════════
-- PARÁMETROS DE PRECIO
-- ══════════════════════════════════════════════════════════════
create table parametros_precio (
  id                   uuid primary key default gen_random_uuid(),
  nombre               text unique not null,
  flete_usd            numeric(12,2) not null,
  cbm_total_contenedor numeric(8,2) not null default 65,
  arancel_pct          numeric(6,4) default 0.10,
  valido_desde         date not null,
  valido_hasta         date,
  activo               boolean default true,
  notas                text,
  created_at           timestamptz default now()
);

-- ══════════════════════════════════════════════════════════════
-- PROFORMAS — Secuencia global 3-XXXX
-- ══════════════════════════════════════════════════════════════
create sequence proforma_numero_seq start with 1 increment by 1;

create table proformas (
  id                   uuid primary key default gen_random_uuid(),
  numero               text unique not null default '',
  numero_cliente       text,
  cliente_id           uuid references clientes(id) not null,
  parametros_precio_id uuid references parametros_precio(id),
  creada_por           uuid references usuarios(id),
  aprobada_por         uuid references usuarios(id),
  fecha                date not null default current_date,
  fecha_vencimiento    date,
  -- Contenedor
  sub_pedido           integer default 1,
  contenedor_ref       text,
  -- Incoterm y modo
  incoterm             text not null default 'FOB',
  modo_pricing         text not null default 'set',
  -- Totales
  total_fob_usd        numeric(12,2),
  total_flete_usd      numeric(12,2),
  total_cif_usd        numeric(12,2),
  -- Estado
  estado               text not null default 'borrador'
                       check (estado in ('borrador','en_revision','aprobada','rechazada','enviada','facturada')),
  notas_internas       text,
  notas_cliente        text,
  motivo_rechazo       text,
  pdf_url              text,
  pdf_generado_at      timestamptz,
  importado_de_excel   boolean default false,
  archivo_origen       text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

create or replace function generar_numero_proforma()
returns trigger language plpgsql as $$
begin
  if new.numero = '' then
    new.numero := '3-' || lpad(nextval('proforma_numero_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger trg_numero_proforma
  before insert on proformas
  for each row execute function generar_numero_proforma();

-- ── LÍNEAS DE PROFORMA ────────────────────────────────────────
create table proforma_lineas (
  id                   uuid primary key default gen_random_uuid(),
  proforma_id          uuid references proformas(id) on delete cascade not null,
  orden                int not null default 0,
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
  notas                text,
  created_at           timestamptz default now()
);

-- ── HISTORIAL DE PRECIOS ──────────────────────────────────────
create table historial_precios (
  id                 uuid primary key default gen_random_uuid(),
  cliente_id         uuid references clientes(id) not null,
  producto_id        uuid references productos(id),
  proforma_id        uuid references proformas(id),
  proforma_numero    text,
  fecha_proforma     date,
  codigo_pdf         text,
  descripcion_pdf    text,
  precio_costo_usd   numeric(12,4),
  precio_cliente_usd numeric(12,4),
  margen_pct         numeric(6,4),
  created_at         timestamptz default now()
);

-- ══════════════════════════════════════════════════════════════
-- DESPACHOS — Módulo logístico
-- ══════════════════════════════════════════════════════════════
create table despachos (
  id                       uuid primary key default gen_random_uuid(),
  proforma_id              uuid references proformas(id) on delete cascade not null,
  -- Naviera y BL
  naviera                  text,
  numero_bl                text,
  puerto_origen            text default 'XINGANG',
  puerto_destino           text default 'KINGSTON',
  -- Fechas
  fecha_despacho           date,
  fecha_llegada_estimada   date,
  fecha_llegada_real       date,
  -- Costo de flete (Shipping Fee — lo paga el cliente)
  shipping_fee_usd         numeric(12,2),
  -- Estado del envío
  estado                   text not null default 'preparando'
                           check (estado in ('preparando','en_transito','en_puerto','entregado')),
  -- Documentos (URLs a Supabase Storage)
  archivo_bl_url           text,
  archivo_shipping_fee_url text,
  archivo_picking_url      text,
  -- Picking info (resumen)
  picking_descripcion      text,
  notas                    text,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

-- ══════════════════════════════════════════════════════════════
-- FLUJO DE APROBACIÓN
-- ══════════════════════════════════════════════════════════════
create table proforma_eventos (
  id           uuid primary key default gen_random_uuid(),
  proforma_id  uuid references proformas(id) on delete cascade not null,
  usuario_id   uuid references usuarios(id),
  estado_desde text,
  estado_hacia text not null,
  comentario   text,
  created_at   timestamptz default now()
);

create table tokens_aprobacion (
  id          uuid primary key default gen_random_uuid(),
  proforma_id uuid references proformas(id) on delete cascade not null,
  token       text unique not null default encode(gen_random_bytes(32), 'hex'),
  usado       boolean default false,
  expira_at   timestamptz not null default (now() + interval '7 days'),
  created_at  timestamptz default now()
);

create table notificaciones (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid references usuarios(id),
  tipo        text not null,
  proforma_id uuid references proformas(id),
  mensaje     text,
  leida       boolean default false,
  created_at  timestamptz default now()
);

-- ══════════════════════════════════════════════════════════════
-- ÍNDICES
-- ══════════════════════════════════════════════════════════════
create index idx_proformas_cliente   on proformas(cliente_id, fecha desc);
create index idx_proformas_estado    on proformas(estado);
create index idx_lineas_pf           on proforma_lineas(proforma_id);
create index idx_lineas_codigo       on proforma_lineas(codigo_pdf);
create index idx_historial_cliente   on historial_precios(cliente_id, fecha_proforma desc);
create index idx_historial_codigo    on historial_precios(codigo_pdf);
create index idx_productos_codigo    on productos(codigo);
create index idx_sku_cliente         on sku_clientes(cliente_id, sku_cliente);
create index idx_despachos_proforma  on despachos(proforma_id);
create index idx_notif_usuario       on notificaciones(usuario_id, leida, created_at desc);

-- ══════════════════════════════════════════════════════════════
-- RLS (Row Level Security)
-- ══════════════════════════════════════════════════════════════
alter table usuarios              enable row level security;
alter table clientes              enable row level security;
alter table sku_clientes          enable row level security;
alter table categorias_producto   enable row level security;
alter table productos             enable row level security;
alter table producto_variantes    enable row level security;
alter table producto_componentes  enable row level security;
alter table parametros_precio     enable row level security;
alter table proformas             enable row level security;
alter table proforma_lineas       enable row level security;
alter table historial_precios     enable row level security;
alter table despachos             enable row level security;
alter table proforma_eventos      enable row level security;
alter table tokens_aprobacion     enable row level security;
alter table notificaciones        enable row level security;

-- Lectura autenticada
create policy "read_auth" on clientes            for select using (auth.role() = 'authenticated');
create policy "read_auth" on sku_clientes        for select using (auth.role() = 'authenticated');
create policy "read_auth" on categorias_producto for select using (auth.role() = 'authenticated');
create policy "read_auth" on productos           for select using (auth.role() = 'authenticated');
create policy "read_auth" on producto_variantes  for select using (auth.role() = 'authenticated');
create policy "read_auth" on producto_componentes for select using (auth.role() = 'authenticated');
create policy "read_auth" on parametros_precio   for select using (auth.role() = 'authenticated');
create policy "read_auth" on proformas           for select using (auth.role() = 'authenticated');
create policy "read_auth" on proforma_lineas     for select using (auth.role() = 'authenticated');
create policy "read_auth" on historial_precios   for select using (auth.role() = 'authenticated');
create policy "read_auth" on despachos           for select using (auth.role() = 'authenticated');
create policy "read_auth" on proforma_eventos    for select using (auth.role() = 'authenticated');

-- Service role: acceso total (para API routes del servidor)
create policy "service_all" on clientes            for all using (auth.role() = 'service_role');
create policy "service_all" on sku_clientes        for all using (auth.role() = 'service_role');
create policy "service_all" on productos           for all using (auth.role() = 'service_role');
create policy "service_all" on producto_variantes  for all using (auth.role() = 'service_role');
create policy "service_all" on producto_componentes for all using (auth.role() = 'service_role');
create policy "service_all" on parametros_precio   for all using (auth.role() = 'service_role');
create policy "service_all" on proformas           for all using (auth.role() = 'service_role');
create policy "service_all" on proforma_lineas     for all using (auth.role() = 'service_role');
create policy "service_all" on historial_precios   for all using (auth.role() = 'service_role');
create policy "service_all" on despachos           for all using (auth.role() = 'service_role');
create policy "service_all" on tokens_aprobacion   for all using (auth.role() = 'service_role');
create policy "service_all" on notificaciones      for all using (auth.role() = 'service_role');
create policy "service_all" on categorias_producto for all using (auth.role() = 'service_role');

-- Usuarios: solo el propio
create policy "usuarios_own"   on usuarios for select using (id = auth.uid());
create policy "notif_own"      on notificaciones for all using (usuario_id = auth.uid());

-- Proformas: autenticados pueden escribir
create policy "proformas_write" on proformas        for all using (auth.role() = 'authenticated');
create policy "lineas_write"    on proforma_lineas  for all using (auth.role() = 'authenticated');
create policy "despachos_write" on despachos        for all using (auth.role() = 'authenticated');
create policy "eventos_write"   on proforma_eventos for all using (auth.role() = 'authenticated');

-- ══════════════════════════════════════════════════════════════
-- SEED — Datos maestros iniciales
-- ══════════════════════════════════════════════════════════════

-- Categorías de producto
insert into categorias_producto (nombre, orden) values
  ('Sanitarios',    1),
  ('Wash Basins',   2),
  ('Seat Covers',   3),
  ('Cabinets',      4),
  ('Puertas',       5),
  ('Ventanas',      6),
  ('Shower Doors',  7),
  ('Gypsum',        8),
  ('Coolers',       9),
  ('Kitchen Sinks', 10);

-- Clientes — con tipo y márgenes según reunión con Marta (2026-07-04)
-- Mayorista: 10-12% | Detallista: 18-20%
insert into clientes (nombre, slug, tipo, margen_min, margen_max, incoterm, modo_pricing, issuer_pdf) values
  ('Designer Solution', 'designer',    'mayorista', 10, 12, 'FOB', 'set',        'Europartners International'),
  ('E&R Hardware',      'er',          'mayorista', 10, 12, 'FOB', 'set',        'Europartners International'),
  ('Hardware & Lumber', 'hl',          'mayorista', 10, 12, 'CIF', 'componente', 'Europartners International'),
  ('HJB Jamaica',       'hjb',         'mayorista', 10, 12, 'CFR', 'set',        'Europartners International'),
  ('Pro Hardware',      'prohardware', 'mayorista', 10, 12, 'FOB', 'set',        'Europartners International');

-- Parámetros de precio
insert into parametros_precio (nombre, flete_usd, cbm_total_contenedor, arancel_pct, valido_desde, activo)
  values ('contenedor_40ft_2025', 3200, 65, 0.10, '2025-01-01', true);
