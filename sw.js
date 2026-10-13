// Service worker de la Agenda de Emilia: permite abrir la app sin internet
// y que cada versión nueva llegue apenas hay conexión.
const CACHE = 'agenda-emilia-v1';
const PRECACHE = ['./', './index.html', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

// Librerías externas que se guardan para usarlas sin conexión
const CDN_HOSTS = ['cdn.tailwindcss.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com',
  'cdn.jsdelivr.net', 'www.gstatic.com', 'cdn.myanimelist.net', 'cdn-icons-png.flaticon.com'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // La base de datos y el inicio de sesión nunca se guardan: siempre van directo a Firebase
  if (url.hostname.endsWith('firebaseio.com') || url.hostname.endsWith('googleapis.com') && !url.hostname.startsWith('fonts.')) return;

  // La página: primero internet (para recibir la versión nueva), si no hay, la copia guardada
  if (req.mode === 'navigate' || (url.origin === self.location.origin && url.pathname.endsWith('.html'))) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Archivos propios y librerías externas: la copia guardada al tiro, y se actualiza por detrás
  if (url.origin === self.location.origin || CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(CACHE).then(cache => cache.match(req).then(cached => {
        const network = fetch(req).then(res => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || network;
      }))
    );
  }
});
