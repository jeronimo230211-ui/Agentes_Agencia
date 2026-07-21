-- ============================================================
-- EUROPARTNERS — Sistema de Operaciones
-- Schema v1.0 — Ejecutar en Supabase SQL Editor
-- ============================================================

-- EXTENSIONES
create extension if not exists "pgcrypto";

-- ══════════════════════════════════════════════════════════════
-- USUARIOS (complementa auth.users de Supabase)
-- ══════════════════════════════════════════════════════════════
create table if not exists usuarios (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  rol        text not null check (rol in ('operaciones', 'admin')),
  -- operaciones = Deisy (crea proformas)
  -- admin       = Marta (aprueba y define márgenes)
  activo     boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ══════════════════════════════════════════════════════════════
-- CLIENTES (5 distribuidores Jamaica)
-- ══════════════════════════════════════════════════════════════
create table if not exists clientes (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  slug                  text unique not null,
  pais                  text default 'Jamaica',
  ciudad                text,
  contacto_nombre       text,
  contacto_email        text,
  contacto_telefono     text,
  incoterm              text not null default 'FOB' check (incoterm in ('FOB','CFR','CIF')),
  modo_pricing          text not null default 'set' check (modo_pricing in ('set','componente')),
  usa_numeracion_propia boolean default false,
  prefijo_numeracion    text,
  margenes_categoria    jsonb default '{"default": 0.15}'::jsonb,
  -- Por cliente se puede configurar issuer del PDF
  -- Pro Hardware: 'Europartners International'; otros: 'Tangshan Tangshengtaicheng Ceramic Corp'
  issuer_pdf            text default 'Europartners International',
  notas                 text,
  activo                boolean default true,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ══════════════════════════════════════════════════════════════
-- CATÁLOGO DE PRODUCTOS
-- ══════════════════════════════════════════════════════════════
create table if not exists categorias_producto (
  id     uuid primary key default gen_random_uuid(),
  nombre text unique not null,
  orden  int default 0
);

create table if not exists productos (
  id               uuid primary key default gen_random_uuid(),
  categoria_id     uuid references categorias_producto(id),
  codigo_tangshan  text unique,
  codigo_interno   text unique,
  descripcion      text not null,
  proveedor        text default 'Tangshan Ceramic Corp',
  precio_fob_usd   numeric(12,4),
  precio_fob_fecha date,
  cbm_unitario     numeric(8,4),
  estado           text default 'activo' check (estado in ('activo','descontinuado','pendiente')),
  notas            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Variantes: puertas (30x80, 32x80, 36x80), cabinets (60cm, 80cm, 100cm), colores
create table if not exists producto_variantes (
  id              uuid primary key default gen_random_uuid(),
  producto_id     uuid references productos(id) on delete cascade not null,
  variante        text not null,
  codigo_variante text,
  precio_fob_usd  numeric(12,4),
  cbm_unitario    numeric(8,4),
  activo          boolean default true,
  unique(producto_id, variante)
);

-- Componentes para Hardware & Lumber (TANK + BOWL + SEATCOVER por separado)
create table if not exists producto_componentes (
  id             uuid primary key default gen_random_uuid(),
  producto_id    uuid references productos(id) on delete cascade not null,
  componente     text not null,
  precio_fob_usd numeric(12,4),
  orden          int default 0
);

-- ══════════════════════════════════════════════════════════════
-- PARÁMETROS DE PRECIO (actualizables sin código)
-- ══════════════════════════════════════════════════════════════
create table if not exists parametros_precio (
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
create sequence if not exists proforma_numero_seq start with 1 increment by 1;

create table if not exists proformas (
  id                   uuid primary key default gen_random_uuid(),
  numero               text unique not null default '',
  numero_cliente       text,
  cliente_id           uuid references clientes(id) not null,
  parametros_precio_id uuid references parametros_precio(id),
  creada_por           uuid references usuarios(id),
  aprobada_por         uuid references usuarios(id),
  fecha                date not null default current_date,
  fecha_vencimiento    date,
  incoterm             text not null default 'FOB',
  modo_pricing         text not null default 'set',
  total_fob_usd        numeric(12,2),
  total_flete_usd      numeric(12,2),
  total_cif_usd        numeric(12,2),
  estado               text not null default 'borrador'
                       check (estado in ('borrador','en_revision','aprobada','rechazada','enviada','facturada')),
  notas_internas       text,
  motivo_rechazo       text,
  pdf_url              text,
  pdf_generado_at      timestamptz,
  importado_de_excel   boolean default false,
  archivo_origen       text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- Trigger auto-número 3-XXXX
create or replace function generar_numero_proforma()
returns trigger language plpgsql as $$
begin
  if new.numero = '' then
    new.numero := '3-' || lpad(nextval('proforma_numero_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_numero_proforma on proformas;
create trigger trg_numero_proforma
  before insert on proformas
  for each row execute function generar_numero_proforma();

-- LÍNEAS DE PROFORMA
create table if not exists proforma_lineas (
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

-- HISTORIAL DE PRECIOS — el núcleo que reemplaza búsqueda en OneDrive
create table if not exists historial_precios (
  id                 uuid primary key default gen_random_uuid(),
  cliente_id         uuid references clientes(id) not null,
  producto_id        uuid references productos(id),
  variante_id        uuid references producto_variantes(id),
  componente_id      uuid references producto_componentes(id),
  proforma_id        uuid references proformas(id),
  proforma_numero    text,
  fecha_proforma     date,
  precio_costo_usd   numeric(12,4),
  precio_cliente_usd numeric(12,4),
  margen_pct         numeric(6,4),
  created_at         timestamptz default now()
);

create index if not exists idx_historial_busqueda
  on historial_precios(cliente_id, producto_id, fecha_proforma desc);

-- ══════════════════════════════════════════════════════════════
-- FLUJO DE APROBACIÓN
-- ══════════════════════════════════════════════════════════════
create table if not exists proforma_eventos (
  id           uuid primary key default gen_random_uuid(),
  proforma_id  uuid references proformas(id) on delete cascade not null,
  usuario_id   uuid references usuarios(id),
  estado_desde text,
  estado_hacia text not null,
  comentario   text,
  created_at   timestamptz default now()
);

-- Tokens para que Marta apruebe por email sin hacer login
create table if not exists tokens_aprobacion (
  id          uuid primary key default gen_random_uuid(),
  proforma_id uuid references proformas(id) on delete cascade not null,
  token       text unique not null default encode(gen_random_bytes(32), 'hex'),
  usado       boolean default false,
  expira_at   timestamptz not null default (now() + interval '7 days'),
  created_at  timestamptz default now()
);

-- NOTIFICACIONES IN-APP
create table if not exists notificaciones (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid references usuarios(id),
  tipo        text not null,
  proforma_id uuid references proformas(id),
  mensaje     text,
  leida       boolean default false,
  created_at  timestamptz default now()
);

-- ══════════════════════════════════════════════════════════════
-- RLS (Row Level Security)
-- ══════════════════════════════════════════════════════════════
alter table usuarios           enable row level security;
alter table proformas          enable row level security;
alter table proforma_lineas    enable row level security;
alter table historial_precios  enable row level security;
alter table notificaciones     enable row level security;
alter table proforma_eventos   enable row level security;

-- Productos, clientes, categorias, parametros: todos autenticados pueden leer
alter table productos           enable row level security;
alter table clientes            enable row level security;
alter table categorias_producto enable row level security;
alter table parametros_precio   enable row level security;
alter table producto_variantes  enable row level security;
alter table producto_componentes enable row level security;

create policy "products_read"    on productos           for select using (auth.role() = 'authenticated');
create policy "clients_read"     on clientes            for select using (auth.role() = 'authenticated');
create policy "cats_read"        on categorias_producto for select using (auth.role() = 'authenticated');
create policy "params_read"      on parametros_precio   for select using (auth.role() = 'authenticated');
create policy "variants_read"    on producto_variantes  for select using (auth.role() = 'authenticated');
create policy "components_read"  on producto_componentes for select using (auth.role() = 'authenticated');

-- Solo admin puede escribir catálogo (via service key en API routes)
create policy "products_admin"   on productos    for all using (auth.role() = 'service_role');
create policy "clients_admin"    on clientes     for all using (auth.role() = 'service_role');

create policy "notif_own"        on notificaciones   for all using (usuario_id = auth.uid());
create policy "proformas_read"   on proformas        for select using (auth.role() = 'authenticated');
create policy "proformas_insert" on proformas        for insert with check (auth.role() = 'authenticated');
create policy "proformas_update" on proformas        for update using (auth.role() = 'authenticated');
create policy "lineas_read"      on proforma_lineas  for select using (auth.role() = 'authenticated');
create policy "lineas_write"     on proforma_lineas  for all   using (auth.role() = 'authenticated');
create policy "historial_read"   on historial_precios for select using (auth.role() = 'authenticated');
create policy "historial_insert" on historial_precios for insert with check (auth.role() = 'service_role');
create policy "eventos_read"     on proforma_eventos  for select using (auth.role() = 'authenticated');
create policy "eventos_insert"   on proforma_eventos  for insert with check (auth.role() = 'authenticated');
create policy "usuarios_own"     on usuarios          for select using (id = auth.uid());
create policy "tokens_service"   on tokens_aprobacion for all   using (auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════════
-- ÍNDICES
-- ══════════════════════════════════════════════════════════════
create index if not exists idx_proformas_cliente on proformas(cliente_id, fecha desc);
create index if not exists idx_proformas_estado  on proformas(estado);
create index if not exists idx_lineas_pf         on proforma_lineas(proforma_id);
create index if not exists idx_productos_codigo  on productos(codigo_tangshan);
create index if not exists idx_notif_usuario     on notificaciones(usuario_id, leida, created_at desc);

-- ══════════════════════════════════════════════════════════════
-- SEED — Datos iniciales
-- ══════════════════════════════════════════════════════════════
insert into clientes (nombre, slug, incoterm, modo_pricing, margenes_categoria, issuer_pdf) values
  ('Designer Solution', 'designer',   'FOB', 'set',
   '{"cabinets":0.15,"sanitarios":0.07,"default":0.12}',
   'Europartners International'),
  ('E&R Hardware',      'er',         'FOB', 'set',
   '{"default":0.15}',
   'Europartners International'),
  ('Hardware & Lumber', 'hl',         'CIF', 'componente',
   '{"default":0.17}',
   'Europartners International'),
  ('HJB Jamaica',       'hjb',        'CFR', 'set',
   '{"default":0.15}',
   'Europartners International'),
  ('Pro Hardware',      'prohardware','FOB', 'set',
   '{"puertas":0.20,"default":0.15}',
   'Europartners International')
on conflict (slug) do nothing;

insert into parametros_precio (nombre, flete_usd, cbm_total_contenedor, arancel_pct, valido_desde, activo)
  values ('contenedor_40ft_2025', 3200, 65, 0.10, '2025-01-01', true)
on conflict (nombre) do nothing;

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
  ('Kitchen Sinks', 10)
on conflict (nombre) do nothing;
