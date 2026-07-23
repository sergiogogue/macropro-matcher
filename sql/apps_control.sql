-- ============================================================================
-- Agrega "Control de Proyectos" al Hub (tabla apps). Aparece en vivo para todos.
-- Idempotente: no duplica si ya existe. Correr una vez en Supabase.
-- ============================================================================
insert into apps (slug, nombre, descripcion, icono, color, url, grupo, recibe_desarrollo, integrada, activo, orden)
select 'control-proyectos', 'Control de Proyectos', 'Mi Día, calendario y seguimiento', '✅', '#c9a961',
       'https://grupoguia-macrolotes.netlify.app/control', 'core', false, true, true, 12
where not exists (select 1 from apps where slug = 'control-proyectos');
