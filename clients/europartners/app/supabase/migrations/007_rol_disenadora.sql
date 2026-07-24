-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 007 — Formaliza el rol 'diseñadora'.
-- Incremental, no destructiva — ver nota en migración 001.
--
-- El rol 'diseñadora' ya fue habilitado a mano vía SQL Editor el 2026-07-22
-- para crear la fila de Laura, pero esa ALTER nunca quedó documentada como
-- migración en el repo (mismo patrón que el rol 'analista' en la 004) —
-- este archivo la formaliza. Mismo bloque dinámico que la 004 porque no se
-- conoce con certeza el nombre actual del constraint tras esa edición manual.
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
  add constraint usuarios_rol_check check (rol in ('operaciones', 'admin', 'analista', 'diseñadora'));
