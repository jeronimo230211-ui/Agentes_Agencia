-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 017 — Módulo Emily (piloto): proformas de costo desde China
-- Incremental, no destructiva — ver nota en migración 001.
--
-- Decidido con Marta/Deisy (reunión 24-ago-2026): Emily (contraparte de
-- compras en China de Europartners) arma su propia proforma con el costo
-- FOB real por producto — reemplaza el PI que hoy manda por email y que
-- Deisy transcribe a mano. Módulo APARTE del resto del sistema: nada de
-- esto es visible para clientes ni toca proformas/solicitudes existentes.
-- Cada envío de Emily queda pendiente de revisión — Deisy/Marta aprueban
-- o rechazan línea por línea antes de que actualice el catálogo.
--
-- Piloto reducido a 2 categorías (Toilets + Pedestal Washbasins, mismo
-- proveedor Thansang) por riesgo de conectividad — Emily accede desde
-- China, probablemente con VPN. Acceso por link con token, sin login
-- (mismo mecanismo que /solicitud/[token] de los clientes).
-- ══════════════════════════════════════════════════════════════

create table if not exists colaboradores_externos (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  token         text unique not null default encode(gen_random_bytes(16), 'hex'),
  categoria_ids uuid[] not null default '{}',
  activo        boolean not null default true,
  created_at    timestamptz default now()
);

create table if not exists proformas_china (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id uuid references colaboradores_externos(id) not null,
  estado         text not null default 'enviada'
                 check (estado in ('enviada', 'aprobada', 'rechazada')),
  notas          text,
  revisada_por   uuid references usuarios(id),
  revisada_at    timestamptz,
  created_at     timestamptz default now()
);

create table if not exists proformas_china_lineas (
  id                   uuid primary key default gen_random_uuid(),
  proforma_china_id    uuid references proformas_china(id) on delete cascade not null,
  producto_id          uuid references productos(id) not null,
  cantidad             numeric(12,2) not null default 1,
  precio_fob_propuesto numeric(12,2) not null,
  precio_fob_anterior  numeric(12,2),
  notas                text,
  estado_linea         text not null default 'pendiente'
                        check (estado_linea in ('pendiente', 'aprobada', 'rechazada')),
  created_at           timestamptz default now()
);

create index if not exists idx_proformas_china_colaborador on proformas_china(colaborador_id);
create index if not exists idx_proformas_china_estado      on proformas_china(estado);
create index if not exists idx_pc_lineas_proforma           on proformas_china_lineas(proforma_china_id);

alter table colaboradores_externos enable row level security;
alter table proformas_china        enable row level security;
alter table proformas_china_lineas enable row level security;

-- Mismo patrón que solicitudes (migración 001): lectura para usuarios
-- autenticados de la app (Deisy/Marta); el acceso público de Emily pasa
-- siempre por /api/emily/[token] usando el service_role, nunca directo.
create policy "read_auth" on colaboradores_externos for select using (auth.role() = 'authenticated');
create policy "read_auth" on proformas_china        for select using (auth.role() = 'authenticated');
create policy "read_auth" on proformas_china_lineas for select using (auth.role() = 'authenticated');

create policy "service_all" on colaboradores_externos for all using (auth.role() = 'service_role');
create policy "service_all" on proformas_china        for all using (auth.role() = 'service_role');
create policy "service_all" on proformas_china_lineas for all using (auth.role() = 'service_role');

-- Colaboradora piloto: Emily, categorías Toilets + Pedestal Washbasins.
-- Correr una sola vez. El token se genera solo (default de la columna) —
-- después de correr esta migración, obtenerlo con:
--   select nombre, token from colaboradores_externos where nombre = 'Emily';
insert into colaboradores_externos (nombre, categoria_ids)
select 'Emily', array_agg(id)
from categorias_producto
where nombre in ('Toilets', 'Pedestal Washbasins');
