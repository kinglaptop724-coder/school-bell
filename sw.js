/* Service Worker - ระบบออดโรงเรียน (ใช้งานออฟไลน์ได้เต็มรูปแบบ)
 * แคชไฟล์ทั้งหมดของแอปไว้ตอนเปิดครั้งแรก แล้วเปิดจากแคชก่อนเสมอ
 * พร้อมอัปเดตเวอร์ชันใหม่เงียบๆ เมื่อมีอินเทอร์เน็ต (เห็นผลเมื่อเปิดหน้าใหม่รอบถัดไป) */
const VERSION = 'remote-4';
const CACHE = 'school-bell-' + VERSION;
const PRECACHE = [
  "./",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "manifest.webmanifest",
  "vendor/fa/css/all.min.css",
  "vendor/fa/webfonts/fa-brands-400.woff2",
  "vendor/fa/webfonts/fa-regular-400.woff2",
  "vendor/fa/webfonts/fa-solid-900.woff2",
  "vendor/fa/webfonts/fa-v4compatibility.woff2",
  "vendor/fonts.css",
  "vendor/fonts/ibm-plex-sans-thai-latin-300-normal.woff2",
  "vendor/fonts/ibm-plex-sans-thai-latin-400-normal.woff2",
  "vendor/fonts/ibm-plex-sans-thai-latin-500-normal.woff2",
  "vendor/fonts/ibm-plex-sans-thai-latin-600-normal.woff2",
  "vendor/fonts/ibm-plex-sans-thai-latin-700-normal.woff2",
  "vendor/fonts/ibm-plex-sans-thai-thai-300-normal.woff2",
  "vendor/fonts/ibm-plex-sans-thai-thai-400-normal.woff2",
  "vendor/fonts/ibm-plex-sans-thai-thai-500-normal.woff2",
  "vendor/fonts/ibm-plex-sans-thai-thai-600-normal.woff2",
  "vendor/fonts/ibm-plex-sans-thai-thai-700-normal.woff2",
  "vendor/tailwind.css"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('school-bell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // ไม่ยุ่งกับคำขอข้ามโดเมน (เช่น Gemini API) และไฟล์เสียง/วิดีโอที่ใช้ Range
  if (url.origin !== self.location.origin) return;
  if (req.headers.has('range')) return;

  // เปิดหน้าเว็บ: ใช้ index.html จากแคช แม้ไม่มีอินเทอร์เน็ต
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html', { ignoreSearch: true }).then((cached) => {
        const update = fetch(req).then((res) => {
          if (res && res.ok) caches.open(CACHE).then((c) => c.put('./index.html', res.clone()));
          return res;
        }).catch(() => null);
        return cached || update.then((r) => r || caches.match('./'));
      })
    );
    return;
  }

  // ไฟล์อื่น: แคชก่อน แล้วอัปเดตเบื้องหลัง
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});


/* ===== แจ้งเตือนมือถือ (push จาก Firebase / Apps Script) ===== */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  const x = Object.assign({}, d.notification || {}, d.data || {});
  event.waitUntil(
    self.registration.showNotification(x.title || 'ออดโรงเรียน', {
      body: x.body || '',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: 'school-bell',
      renotify: true,
      vibrate: [200, 100, 200]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) { if ('focus' in c) { await c.focus(); return; } }
    await self.clients.openWindow('./');
  })());
});
