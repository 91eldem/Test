const CACHE = 'bogdan-diary-pwa-v3';
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon.svg',
  './music/beneath-the-mask-rain.mp3',
  './music/memories-of-summer.mp3',
  './music/no-more-what-ifs.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Media elements use Range requests. Serve cached MP3s with a valid 206 response.
  if (url.pathname.toLowerCase().endsWith('.mp3')) {
    event.respondWith((async () => {
      const cached = await caches.match(request.url);
      if (cached) {
        const range = request.headers.get('range');
        if (!range) return cached;
        const buffer = await cached.arrayBuffer();
        const size = buffer.byteLength;
        const match = /bytes=(\d*)-(\d*)/.exec(range);
        if (!match) return cached;
        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Number(match[2]) : size - 1;
        if (start >= size || start > end) {
          return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
        }
        const safeEnd = Math.min(end, size - 1);
        return new Response(buffer.slice(start, safeEnd + 1), {
          status: 206,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': String(safeEnd - start + 1),
            'Content-Range': `bytes ${start}-${safeEnd}/${size}`,
            'Accept-Ranges': 'bytes'
          }
        });
      }
      return fetch(request);
    })());
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
