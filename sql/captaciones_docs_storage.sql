-- ════════════════════════════════════════════════════════════════════
-- MacroPro · Adjuntar documentos (PDF/fotos) en el formulario de opción
-- (captar.html) para abrirlos dentro de la ficha.
-- Correr UNA vez en Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- 1) Columna para guardar las ligas de los archivos en la captación
alter table public.captaciones
  add column if not exists documentos_urls jsonb default '[]'::jsonb;

-- 2) Bucket de almacenamiento público para los archivos
insert into storage.buckets (id, name, public)
values ('captaciones-docs', 'captaciones-docs', true)
on conflict (id) do update set public = true;

-- 3) Permisos en storage.objects para ese bucket:
--    - anon (formulario público) SOLO puede SUBIR (insert)
--    - lectura pública (para abrir los archivos desde la ficha)
drop policy if exists captdocs_anon_insert on storage.objects;
create policy captdocs_anon_insert
  on storage.objects for insert to anon
  with check (bucket_id = 'captaciones-docs');

drop policy if exists captdocs_public_read on storage.objects;
create policy captdocs_public_read
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'captaciones-docs');

-- (Opcional) permitir a usuarios logueados subir/borrar también:
-- drop policy if exists captdocs_auth_all on storage.objects;
-- create policy captdocs_auth_all on storage.objects for all to authenticated
--   using (bucket_id='captaciones-docs') with check (bucket_id='captaciones-docs');
