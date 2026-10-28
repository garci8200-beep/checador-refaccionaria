

const VERSION = 'posfn-v45';
const CACHE = 'posfn-shell-' + VERSION;

const SHELL = [
  './',
  './index.html',
  './app.js'
];

const CDN_LIBS = [
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js',
  'https://cdn.tailwindcss.com/3.4.17',
  'https://cdn.jsdelivr.net/npm/lucide@0.263.0/dist/umd/lucide.min.js',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'
];

const STATIC_HOSTS = [
  'cdn.tailwindcss.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'www.gstatic.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// Tiempo máximo que se espera a la red con internet débil antes de usar caché.
const NET_TIMEOUT_MS = 2800;

function navKey(url) {
  let last = '';
  try { last = new URL(url).pathname.split('/').pop() || ''; } catch (e) { last = ''; }
  if (last.toLowerCase() === 'menu.html') return './menu.html';
  if (last.toLowerCase() === 'citas.html') return './citas.html';
  return './index.html';
}

function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('net-timeout')), ms);
    fetch(req).then(
      (res) => { clearTimeout(t); resolve(res); },
      (err) => { clearTimeout(t); reject(err); }
    );
  });
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL).catch(() => null))
      .then(() => {
        // Los CDN se cachean SIN bloquear: si hay internet lento, no frenan la instalación.
        e.waitUntil(
          caches.open(CACHE).then((c) =>
            Promise.all(CDN_LIBS.map((u) => {
              try {
                return fetchWithTimeout(u, NET_TIMEOUT_MS)
                  .then((res) => {
                    if (res && res.ok) return c.put(u, res.clone()).catch(() => null);
                    return null;
                  })
                  .catch(() => null);
              } catch (err) { return Promise.resolve(null); }
            }))
          ).catch(() => null)
        );
      })
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e && e.data === 'SKIP_WAITING') self.skipWaiting();
});

// Background Sync + avisos de red: cuando vuelve la señal, se ordena a las
// pestañas abiertas vaciar la cola de Firestore y reintentar pedidos pendientes.
// (La cola real vive en IndexedDB del SDK y sobrevive al cierre de la app;
// esto solo acelera el reintento en cuanto hay red, vital con datos intermitentes.)
async function notifyFlush() {
  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((cl) => {
      try { cl.postMessage({ type: 'FLUSH_SYNC' }); } catch (err) {}
    });
  } catch (err) {}
}
self.addEventListener('sync', (e) => {
  try {
    if (e && e.tag && String(e.tag).indexOf('posfn') === 0) {
      e.waitUntil(notifyFlush());
    } else if (e) {
      e.waitUntil(notifyFlush());
    }
  } catch (err) {}
});
self.addEventListener('online', () => { try { notifyFlush(); } catch (e) {} });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url = null;
  try { url = new URL(req.url); } catch (err) { return; }

  // NAVEGACIÓN: caché primero = interfaz instantánea con datos débiles.
  if (req.mode === 'navigate') {
    const key = navKey(req.url);
    e.respondWith(
      caches.match(key).then((cached) => {
        // 1) Hay copia: se sirve AL INSTANTE y se refresca en segundo plano.
        const bgRefresh = fetchWithTimeout(req, NET_TIMEOUT_MS)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(key, copy).catch(() => null));
            }
            return res;
          })
          .catch(() => null);
        if (cached) {
          // No se espera a la red: la pantalla pinta de inmediato.
          e.waitUntil(bgRefresh);
          return cached;
        }
        // 2) Sin copia (primera visita): se intenta la red con timeout, si no, shell.
        return bgRefresh
          .then((res) => res || caches.match('./index.html'))
          .catch(() => caches.match(key).then((hit) => hit || caches.match('./index.html')));
      })
    );
    return;
  }

  const isStaticHost = STATIC_HOSTS.includes(url.hostname);
  const isOwnFile = url.origin === self.location.origin;

  // ESTÁTICOS: al instante desde caché, refresco silencioso en segundo plano.
  if (isStaticHost || isOwnFile) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const refresh = fetchWithTimeout(req, NET_TIMEOUT_MS)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy).catch(() => null));
            }
            return res;
          })
          .catch(() => cached);
        // Con copia: instantáneo. Sin copia: se espera a la red (con timeout).
        return cached || refresh.then((res) => res || cached);
      })
    );
  }
  // Lo demás (Firestore, analytics, WhatsApp, licencias) pasa directo a la red.
});
