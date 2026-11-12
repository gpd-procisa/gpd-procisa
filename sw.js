// Service Worker do GPD Campo - Network First V2
const CACHE_NAME = 'gpd-campo-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Estratégia Network-First (Tenta a internet primeiro, se falhar usa o cache offline)
self.addEventListener('fetch', (event) => {
  // Ignora requisições ao Supabase e que não sejam GET
  if (event.request.url.includes('supabase.co') || event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Sucesso na rede: guarda a versão mais nova no cache e devolve
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() => {
        // Sem internet: devolve o que está salvo no cache
        return caches.match(event.request);
      })
  );
});
