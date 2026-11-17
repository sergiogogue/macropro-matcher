// MacroPro Service Worker — v3 (v6.05)
// Estrategia por tipo de recurso:
//   • La app (index.html y archivos propios): RED PRIMERO → siempre trae la versión nueva;
//     sin internet usa la copia guardada.
//   • Librerías de CDN con versión fija (react 18.2.0, leaflet 1.9.4, jspdf 2.5.1…): CACHÉ PRIMERO.
//     Nunca cambian, así que se bajan una vez y se guardan en "mp-cdn" (sobrevive a las
//     actualizaciones de la app: no se vuelven a descargar en cada versión).
//   • Librerías sin versión fija (supabase-js@2) y fuentes: copia guardada al instante y se
//     actualiza en segundo plano.
//   • Supabase, funciones de Netlify y todo lo demás: NO se tocan (pasan directo a la red).
//     Antes se guardaba cada respuesta de Supabase en caché (megabytes cada 45 s).
// El código traducido de la app vive en "mp-app-compilado" (lo maneja index.html).

const CACHE_NAME = 'macropro-v108';
const CDN_CACHE = 'mp-cdn-v1';
const CONSERVAR = [CACHE_NAME, CDN_CACHE, 'mp-app-compilado'];
const APP_SHELL = ['./', './index.html', './manifest.json'];
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.warn('No se pudo precargar la app:', err))
  );
});

// Compatibilidad con el botón "Actualizar" de la app.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Al activar: borra solo caches viejos de la app (conserva librerías y el código traducido).
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) => Promise.all(
      nombres.filter((n) => !CONSERVAR.includes(n)).map((n) => caches.delete(n))
    ))
  );
  self.clients.claim();
});

const versionFija = (url) => /\/\d+\.\d+\.\d+\/|@\d+\.\d+\.\d+\//.test(url);

function guardar(cacheName, request, response) {
  // response.ok cubre 200; las respuestas "opaque" (CDN sin CORS) también se guardan.
  if (response && (response.ok || response.type === 'opaque')) {
    const copia = response.clone();
    caches.open(cacheName).then((c) => c.put(request, copia)).catch(() => {});
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Librerías y fuentes de CDN
  if (CDN_HOSTS.includes(url.hostname)) {
    if (versionFija(url.pathname) || url.hostname === 'fonts.gstatic.com') {
      // Caché primero (archivos inmutables)
      event.respondWith(
        caches.open(CDN_CACHE).then((c) => c.match(req)).then((hit) =>
          hit || fetch(req).then((res) => guardar(CDN_CACHE, req, res))
        )
      );
    } else {
      // Copia al instante + actualización en segundo plano
      event.respondWith(
        caches.open(CDN_CACHE).then((c) => c.match(req)).then((hit) => {
          const red = fetch(req).then((res) => guardar(CDN_CACHE, req, res)).catch(() => hit);
          return hit || red;
        })
      );
    }
    return;
  }

  // Archivos propios de la app (mismo origen): red primero, copia si no hay internet.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => guardar(CACHE_NAME, req, res))
        .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
    );
    return;
  }
  // Todo lo demás (Supabase, Netlify, APIs): sin intervenir.
});
