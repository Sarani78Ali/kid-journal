/* Offline support. Bump CACHE_NAME whenever index.html or manifest.json changes. */
const CACHE_NAME = 'kid-journal-v9';

// the app cannot start offline without these
const REQUIRED = ['./', './index.html', './manifest.json'];
// a missing icon must not fail the install
const OPTIONAL = ['./logo-192.png', './logo-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(REQUIRED).then(() => Promise.allSettled(OPTIONAL.map(url => cache.add(url)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // pages: network first so updates arrive, cache when offline; only healthy responses are stored
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then(cached => cached || caches.match('./')))
    );
    return;
  }

  // everything else: cache first, then network
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
      }
      return res;
    }))
  );
});
