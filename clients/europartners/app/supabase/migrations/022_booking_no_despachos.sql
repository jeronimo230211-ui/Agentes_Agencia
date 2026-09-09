-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 022 — despachos.booking_no
-- Incremental, no destructiva — ver nota en migración 001.
--
-- Pedido de Jero: al cargar los datos de un despacho hace falta el
-- "Booking No." (número de reserva que asigna la naviera al hacer el
-- booking del contenedor) — con este dato se puede buscar la guía
-- directamente en el sitio de la naviera, sin depender solo del
-- número de BL (numero_bl), que muchas veces no está disponible hasta
-- que el contenedor ya zarpó.
--
-- Columna de texto, nullable: los despachos históricos no van a tener
-- este dato cargado, y no todos los despachos nuevos lo van a tener
-- desde el día uno (se carga a mano en el modal de despacho, igual
-- que naviera/numero_bl — ver app/(app)/despachos/page.tsx).
-- ══════════════════════════════════════════════════════════════

alter table despachos add column if not exists booking_no text;
