-- ════════════════════════════════════════════════════════════════════
-- MacroPro · Opción/Captación · Autorización para comercializar
-- Agrega el precio autorizado por la Dirección + observaciones para el asesor.
-- Correr UNA vez en Supabase → SQL Editor.
-- (La app ya funciona sin esto: guarda local y reintenta sin estas columnas;
--  al correr el SQL, el dato se sincroniza entre los 3 usuarios y sale en el
--  documento de Autorización/Negación.)
-- ════════════════════════════════════════════════════════════════════

alter table public.captaciones
  add column if not exists precio_autorizado          numeric,
  add column if not exists observaciones_autorizacion text;

-- Notas:
-- • precio_autorizado: precio que la Dirección autoriza para comercializar el predio.
-- • observaciones_autorizacion: observaciones/condiciones que verá el asesor opcionador
--   cuando se le mande la Autorización/Negación.
-- • Solo el administrador edita estos campos desde la ficha de Opción (control en la UI).
