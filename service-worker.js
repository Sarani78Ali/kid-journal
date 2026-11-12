/* Offline support. Files are fetched fresh (bypassing the browser's HTTP cache) and the cache is the offline fallback,
   so a new version no longer depends on remembering to bump CACHE_NAME; bumping it only clears old caches. */
const CACHE_NAME = 'kid-journal-v12';

// the app cannot start offline without these
const REQUIRED = ['./', './index.html', './Style/Style.css', './manifest.json'];
// a missing icon must not fail the install
const OPTIONAL = ['./Style/Font/IRANSans.woff2', './logo-192.png', './logo-512.png'];
// with a cached copy at hand, a slow network must not hold the app up longer than this (ms)
const NETWORK_WAIT = 4000;

const fresh = url => new Request(url, {cache: 'reload'});

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(REQUIRED.map(fresh)).then(() => Promise.allSettled(OPTIONAL.map(url => cache.add(fresh(url))))))
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

async function freshOrCached(req) {
  const cache = await caches.open(CACHE_NAME);
  // every page address is stored as the one app page
  const key = req.mode === 'navigate' ? './index.html' : req;
  const copy = await cache.match(key);
  const network = fetch(req, {cache: 'no-cache'}).then(res => {
    if (res.ok) { cache.put(key, res.clone()); return res; }
    return copy || res;   // an error page must not replace a working copy
  });
  if (!copy) return network;
  return Promise.race([network.catch(() => copy), new Promise(done => setTimeout(done, NETWORK_WAIT, copy))]);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(freshOrCached(req));
});
