-- Dirección de envío/entrega del cliente — no existía ningún campo de
-- dirección en el sistema (despachos.puerto_origen/destino es logística
-- puerto a puerto, no la dirección del cliente). contacto_nombre/email/
-- telefono ya existían desde schema_v2 pero seguían vacíos en los 5+
-- clientes reales — este cambio es el primer mecanismo real para llenarlos:
-- el cliente los llena solo (link público, opcional) o Deisy/Marta los
-- llenan a mano desde /solicitudes.
alter table clientes
  add column if not exists direccion text;
