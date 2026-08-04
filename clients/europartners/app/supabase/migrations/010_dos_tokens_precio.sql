-- Dos links por cliente (mayorista/detallista) para el catálogo público
-- (/solicitud/[token]) — antes el precio mostrado dependía únicamente de
-- clientes.tipo (un solo link por cliente). Ahora cada cliente tiene un
-- token por cada tipo de precio, y el tipo se resuelve por CUÁL de los dos
-- tokens se usó, no por clientes.tipo (ese campo sigue existiendo para otros
-- usos, ej. el default del cotizador).
alter table clientes
  add column if not exists token_mayorista text unique,
  add column if not exists token_detallista text unique;

-- Backfill: el token_solicitud que ya existía (y que ya está compartido con
-- clientes/prospectos reales) se reutiliza tal cual como el token del tipo
-- de precio que el cliente ya tenía — así ningún link ya enviado se rompe.
-- Se genera un token nuevo para el tipo de precio que le faltaba.
update clientes
set token_mayorista = case when tipo = 'mayorista' then token_solicitud else encode(gen_random_bytes(16), 'hex') end,
    token_detallista = case when tipo = 'detallista' then token_solicitud else encode(gen_random_bytes(16), 'hex') end
where token_mayorista is null or token_detallista is null;

alter table clientes
  alter column token_mayorista set default encode(gen_random_bytes(16), 'hex'),
  alter column token_detallista set default encode(gen_random_bytes(16), 'hex');
