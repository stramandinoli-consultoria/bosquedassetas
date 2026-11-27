/*
 * Service worker do PWA: guarda os arquivos do jogo no aparelho para
 * funcionar offline. Estratégia "stale-while-revalidate": responde do cache
 * na hora e atualiza em segundo plano.
 * Mude CACHE ao publicar uma versão com mudanças grandes.
 */
const CACHE = 'setas-v6';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // API (ranking, conta) nunca vem do cache
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api') || url.pathname === '/health') return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
