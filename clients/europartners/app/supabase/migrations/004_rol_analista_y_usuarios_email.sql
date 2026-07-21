-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 004 — Formaliza el rol 'analista' + usuarios.email.
-- Incremental, no destructiva — ver nota en migración 001.
--
-- El rol 'analista' ya fue habilitado a mano vía SQL Editor el
-- 2026-07-19 (fila de Jeronimo ya vive con rol='analista' en
-- producción) pero esa ALTER nunca quedó documentada como migración
-- en el repo — este archivo la formaliza. Se usa un bloque dinámico
-- porque no se conoce con certeza el nombre actual del constraint
-- tras esa edición manual (podría seguir siendo el autogenerado
-- usuarios_rol_check o haber cambiado).
-- ══════════════════════════════════════════════════════════════

do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.usuarios'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%rol%'
  loop
    execute format('alter table usuarios drop constraint %I', r.conname);
  end loop;
end $$;

alter table usuarios
  add constraint usuarios_rol_check check (rol in ('operaciones', 'admin', 'analista'));

-- ── Email por usuario (para notificaciones, en vez de env vars sueltas) ──
alter table usuarios add column if not exists email text;

update usuarios u
set email = a.email
from auth.users a
where a.id = u.id and u.email is null;
