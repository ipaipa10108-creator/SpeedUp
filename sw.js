const CACHE_NAME = 'speedup-v8';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './converter.js',
  './i18n.js',
  './manifest.json',
  './lib/lame.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const files = formData.getAll('audio') || formData.getAll('file') || formData.getAll('files');

          if (files && files.length > 0) {
            const file = files[0];
            const arrayBuffer = await file.arrayBuffer();
            const db = await openShareDB();
            const tx = db.transaction('shared-files', 'readwrite');
            const store = tx.objectStore('shared-files');
            await store.put({
              name: file.name,
              type: file.type,
              data: Array.from(new Uint8Array(arrayBuffer)),
              timestamp: Date.now()
            });
          }
        } catch (e) {
          console.warn('Share target error:', e);
        }
        return Response.redirect(self.location.origin + self.location.pathname, 303);
      })()
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});

function openShareDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('speedup-share', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('shared-files', { keyPath: 'timestamp' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
