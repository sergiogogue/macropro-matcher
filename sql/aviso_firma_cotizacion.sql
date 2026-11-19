-- Aviso por WhatsApp (chatbot) a Dirección cuando el PROPIETARIO firma su cotización.
-- Marca de "ya avisado" para no repetirlo (la usa netlify/functions/opcionador-firmo-aviso.js).
-- Idempotente.
alter table public.cotizaciones_opcionador add column if not exists aviso_firma_at timestamptz;
-- Las que ya estaban firmadas no se re-avisan.
update public.cotizaciones_opcionador set aviso_firma_at = coalesce(aceptada_at, now())
 where terminos_aceptados = true and aviso_firma_at is null;
-- Verificación: Dirección (Sergio y Fernanda) con celular en landing_colaboradores.
select email, celular, activo from public.landing_colaboradores
 where email in ('sergio@grupoguia.mx', 'mortuno@grupoguia.mx');
