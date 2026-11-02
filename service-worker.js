/* Kid Journal service worker
   هر بار index.html یا manifest.json را عوض کردی، شماره‌ی کش را بالا ببر (v8 → v9 → ...) */
const CACHE_NAME = 'kid-journal-v8';

/* بدون این‌ها برنامه آفلاین بالا نمی‌آید */
const REQUIRED = ['./', './index.html', './manifest.json'];
/* اگر یکی از آیکون‌ها کنار فایل‌ها نباشد، نصب نباید شکست بخورد */
const OPTIONAL = ['./logo-192.png', './logo-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(REQUIRED).then(() => Promise.allSettled(OPTIONAL.map((u) => cache.add(u)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // صفحه اصلی: اول شبکه (برای گرفتن آپدیت)؛ فقط پاسخ سالم در کش ذخیره می‌شود. آفلاین بود، کش
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // بقیه فایل‌ها: اول کش، بعد شبکه
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
