// MacroPro Service Worker — v2
// Cachea el HTML, fonts y librerías React/Babel para que la app
// funcione aunque no haya internet. Estrategia network-first: online
// siempre trae la versión nueva; offline usa el cache.
// La versión nueva ESPERA a que el usuario toque "Actualizar" (mensaje
// SKIP_WAITING) para no interrumpir el trabajo a medias.

const CACHE_NAME = 'macropro-v2';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700;900&family=DM+Sans:wght@400;500;600;700;800&display=swap'
];

// Al instalar: cachea todos los recursos críticos.
// NO llamamos skipWaiting aquí: el SW nuevo queda "waiting" hasta que el
// usuario toque "Actualizar" (así no se interrumpe el trabajo a medias).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE).catch((err) => {
        console.warn('Algunos recursos no se pudieron cachear:', err);
      });
    })
  );
});

// La app pide activar la versión nueva cuando el usuario toca "Actualizar"
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Al activar: limpia caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia: Network-first, fallback a cache
// Así siempre intenta traer la versión más nueva, pero si no hay internet usa cache
self.addEventListener('fetch', (event) => {
  // Solo cachear GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la respuesta es buena, guardar en cache
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Sin internet: buscar en cache
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('./index.html');
        });
      })
  );
});
