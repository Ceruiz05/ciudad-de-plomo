// Service worker de Ciudad de Plomo: guarda el juego para jugar sin internet.
// Al publicar una versión nueva del juego, sube el número de CACHE.
const CACHE = 'plomo-v9';
const SHELL = [
  './',
  './index.html',
  './press-start-2p.woff2',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
];

// cache: 'reload' salta la copia que GitHub Pages deja en el navegador (~10 min) y baja la versión real
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

// El juego pregunta "?plomo-check" al abrir: se baja index.html fresco, se compara con la copia
// guardada y, si cambió, se guarda y se responde { updated: true } para ofrecer "Actualizar".
async function checkForUpdate() {
  try {
    const res = await fetch('./index.html', { cache: 'no-cache' });
    if (!res.ok) return json({ updated: false });
    const fresh = await res.text();
    const hit = await caches.match('./index.html');
    const old = hit ? await hit.text() : null;
    if (fresh === old) return json({ updated: false });
    const cache = await caches.open(CACHE);
    await cache.put('./index.html', new Response(fresh, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
    return json({ updated: old !== null });
  } catch (err) {
    return json({ updated: false, offline: true });
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin && url.searchParams.has('plomo-check')) {
    e.respondWith(checkForUpdate());
    return;
  }

  // la página: abre al instante con la copia guardada (con señal mala ya no se queda esperando)
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then(hit => hit || fetch(req)));
    return;
  }

  // tipografía, íconos y manifest: primero la copia guardada
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
