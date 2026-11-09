#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// Pruebas de estrés de MacroPro · Liga Mágica + expediente + aprobación
// ────────────────────────────────────────────────────────────────────
// Qué valida (contra Supabase REAL):
//   1) Crear captación → generar Liga Mágica → el token/link se genera.
//   2) Token EXPIRADO → legal_subir_doc debe RECHAZAR la subida.
//   3) "Aprobar para publicar" actualiza el estatus SIN escribir en `lotes`
//      (publicada_lote_id sigue null; eso lo hace la Landing).
//
// Uso:
//   SUPABASE_URL=... SUPABASE_KEY=<anon> \
//   TEST_EMAIL=tu@grupoguia.mx TEST_PASSWORD=*** \
//   node scripts/test-macropro-estres.js
//
// Notas:
//   · Requiere sesión de un colaborador (las escrituras en `captaciones` piden
//     authenticated). legal_subir_doc es anon (token-gated), por eso se prueba sin sesión.
//   · Requiere haber corrido sql/liga_magica_expediente.sql y sql/liga_magica_vencimiento.sql.
//   · Limpia lo que crea (borra la captación de prueba al final).
// ════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xugrrabebphdelgwqnwc.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_n-EUveYY5vHlCQdDLEOU7w_4ndCZaJ0'
const TEST_EMAIL = process.env.TEST_EMAIL || ''
const TEST_PASSWORD = process.env.TEST_PASSWORD || ''

let pasa = 0, falla = 0
const ok = (m) => { pasa++; console.log('  ✅ ' + m) }
const no = (m) => { falla++; console.log('  ❌ ' + m) }
const seccion = (m) => console.log('\n── ' + m + ' ──')

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  // Cliente del EQUIPO (con sesión) para crear/aprobar; cliente ANÓNIMO para el portal.
  const team = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  const anon = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  if (TEST_EMAIL && TEST_PASSWORD) {
    const { error } = await team.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD })
    if (error) { console.error('No se pudo iniciar sesión de prueba:', error.message); process.exit(2) }
    console.log('Sesión de equipo iniciada como', TEST_EMAIL)
  } else {
    console.log('⚠ Sin TEST_EMAIL/TEST_PASSWORD: se omiten las pruebas que escriben en captaciones.')
  }

  const capId = 'test-estres-' + Date.now()
  let token = null

  try {
    // ── 1) Crear captación → Liga Mágica ──
    seccion('1 · Crear captación y generar Liga Mágica')
    if (TEST_EMAIL && TEST_PASSWORD) {
      const { error: insErr } = await team.from('captaciones').insert({
        id: capId, pipeline: 'Nueva opción', propietario: 'Prueba Estrés',
        zona: 'Terreno de Prueba', ciudad: 'Ciudad Test', estado: 'esperando documentos',
      })
      if (insErr) { no('insertar captación: ' + insErr.message) }
      else {
        const { data, error } = await team.from('captaciones').select('liga_token, token_expira_at').eq('id', capId).limit(1)
        const row = data && data[0]
        if (error || !row) no('leer la captación creada')
        else {
          token = row.liga_token
          token ? ok('liga_token generado: ' + String(token).slice(0, 8) + '…') : no('no se generó liga_token (¿corriste el SQL de Liga Mágica?)')
          const link = 'https://sergiogogue.github.io/macropro-matcher/captar.html?token=' + token
          token && ok('link de la Liga Mágica armado: ' + link)
          row.token_expira_at ? ok('token_expira_at presente: ' + row.token_expira_at) : no('falta token_expira_at (corre liga_magica_vencimiento.sql)')
        }
      }
    } else { console.log('  (omitido: requiere sesión de equipo)') }

    // ── 2) Token expirado bloquea la subida ──
    seccion('2 · Token EXPIRADO bloquea la subida (legal_subir_doc)')
    if (token && TEST_EMAIL && TEST_PASSWORD) {
      const ayer = new Date(Date.now() - 86400000).toISOString()
      const { error: updErr } = await team.from('captaciones').update({ token_expira_at: ayer }).eq('id', capId)
      if (updErr) no('simular expiración: ' + updErr.message)
      else {
        const { error } = await anon.rpc('legal_subir_doc', { p_token: token, p_tipo: 'INE', p_url: 'https://x/t.pdf' })
        if (error && /expir/i.test(error.message)) ok('subida RECHAZADA por token expirado: ' + error.message)
        else if (error) no('rechazó pero por otro motivo: ' + error.message)
        else no('⚠ PERMITIÓ subir con token expirado (revisa legal_subir_doc)')
      }
    } else { console.log('  (omitido: requiere token de la prueba 1)') }

    // ── 3) Aprobar para publicar NO escribe en lotes ──
    seccion('3 · "Aprobar para publicar" actualiza estatus sin escribir en lotes')
    if (token && TEST_EMAIL && TEST_PASSWORD) {
      const { error: apErr } = await team.from('captaciones').update({ aprobada_publicar: true }).eq('id', capId)
      if (apErr) no('marcar aprobada_publicar: ' + apErr.message)
      else {
        const { data } = await team.from('captaciones').select('aprobada_publicar, publicada_lote_id').eq('id', capId).limit(1)
        const row = data && data[0]
        row && row.aprobada_publicar ? ok('aprobada_publicar = true') : no('no quedó aprobada_publicar')
        row && (row.publicada_lote_id == null) ? ok('publicada_lote_id sigue null (MacroPro NO escribe en lotes)') : no('publicada_lote_id se escribió desde MacroPro (no debería)')
      }
    } else { console.log('  (omitido: requiere token de la prueba 1)') }
  } finally {
    // ── Limpieza ──
    if (TEST_EMAIL && TEST_PASSWORD) {
      try { await team.from('captaciones_legal').delete().eq('captacion_id', capId) } catch (e) {}
      try { await team.from('captaciones').delete().eq('id', capId); console.log('\n🧹 Captación de prueba eliminada (' + capId + ')') } catch (e) {}
    }
  }

  console.log('\n═══════════════════════════════════')
  console.log(`Resultado: ${pasa} ✅  ·  ${falla} ❌`)
  process.exit(falla > 0 ? 1 : 0)
}

main().catch((e) => { console.error('Error fatal en la suite:', e && e.message || e); process.exit(2) })
