-- ════════════════════════════════════════════════════════════════════
-- MacroPro · Opción/Captación · Respuestas al asesor (dictamen/comentarios)
-- Guarda el registro (estadística + seguimiento) de cada respuesta enviada al
-- asesor por WhatsApp/Email desde la ficha de Opción.
-- Correr UNA vez en Supabase → SQL Editor.
-- (La app funciona sin esto: guarda local y reintenta sin esta columna; al correr
--  el SQL, el registro se sincroniza entre los 3 usuarios.)
-- ════════════════════════════════════════════════════════════════════

alter table public.captaciones
  add column if not exists respuestas jsonb default '[]'::jsonb;

-- Estructura de cada elemento de `respuestas` (jsonb array):
--   { fecha, canal ('whatsapp'|'email'), tipo ('dictamen'|'comentario'),
--     estado?, precioAutorizado?, observaciones?, texto? }
