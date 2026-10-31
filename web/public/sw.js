// Weyvo service worker.
// 1. Offline: the app itself (page, code, fonts) and photos you've already seen are kept on the device, so
//    Weyvo opens and shows saved stories without a signal. Other API data is never cached here (the app keeps
//    its own small copy), and nothing is cached for other sites.
// 2. Push notifications: shows them and opens the right page when one is tapped.

const APP = 'weyvo-app-v2';
const PHOTOS = 'weyvo-photos';
const MAX_PHOTOS = 120;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP).then((c) => c.addAll(['/', '/favicon.svg', '/icon-512.png', '/pin.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('weyvo-app-') && k !== APP).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Pages: always try the network for the newest app; fall back to the kept copy when offline.
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(APP).then((c) => c.put('/', res.clone()));
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  // Built code and styles have a fingerprint in their name, so a kept copy is always right.
  const isAsset = url.origin === self.location.origin && url.pathname.startsWith('/assets/');
  const isFont = url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com';
  if (isAsset || isFont) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') caches.open(APP).then((c) => c.put(req, res.clone()));
        return res;
      })),
    );
    return;
  }

  // Photos already seen: from the device first, refreshed in the background. Only the newest 120 are kept.
  if (url.origin === self.location.origin && /^\/api\/photos\/\d+\/(thumb|large)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(PHOTOS).then(async (cache) => {
        const hit = await cache.match(req);
        const fresh = fetch(req).then(async (res) => {
          if (res.ok) {
            await cache.put(req, res.clone());
            const keys = await cache.keys();
            if (keys.length > MAX_PHOTOS) await Promise.all(keys.slice(0, keys.length - MAX_PHOTOS).map((k) => cache.delete(k)));
          }
          return res;
        }).catch(() => hit);
        return hit || fresh;
      }),
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/notifications';
  event.waitUntil(
    self.registration.showNotification(data.title || 'Weyvo', {
      body: data.body || 'Something new on Weyvo',
      icon: '/icon-512.png',
      badge: '/favicon-badge.png',
      data: { url },
      tag: url,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : '/notifications', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.startsWith(self.location.origin) && 'focus' in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
