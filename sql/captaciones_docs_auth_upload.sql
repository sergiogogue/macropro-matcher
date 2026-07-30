-- ════════════════════════════════════════════════════════════════════
-- MacroPro · Permitir que los usuarios LOGUEADOS suban archivos al bucket
-- captaciones-docs (para guardar el PDF del dictamen desde la ficha de Opción).
-- El formulario público (anon) ya podía insertar; esto agrega a los autenticados.
-- Correr UNA vez en Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- Subir (insert) y sobrescribir (update) sus archivos para usuarios autenticados
drop policy if exists captdocs_auth_write on storage.objects;
create policy captdocs_auth_write
  on storage.objects for insert to authenticated
  with check (bucket_id = 'captaciones-docs');

drop policy if exists captdocs_auth_update on storage.objects;
create policy captdocs_auth_update
  on storage.objects for update to authenticated
  using (bucket_id = 'captaciones-docs')
  with check (bucket_id = 'captaciones-docs');

-- La lectura pública ya existe (captdocs_public_read). El bucket es público, así que
-- el enlace del PDF se puede abrir/compartir por WhatsApp/Email.
