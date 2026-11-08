// Øk VERSION ved hver publisering, ellers får ikke installerte apper den nye koden.
const VERSION = '2';
const CACHE = `litt-hver-dag-${VERSION}`;

const PRECACHE = [
  './',
  'index.html',
  'manifest.json',
  'css/app.css',
  'js/main.js',
  'js/router.js',
  'js/db.js',
  'js/ui.js',
  'js/install.js',
  'js/backup.js',
  'js/format.js',
  'js/timer.js',
  'js/device.js',
  'js/assessment.js',
  'js/data/assessment-tests.js',
  'js/data/exercises.js',
  'js/program.js',
  'js/session.js',
  'js/progression.js',
  'js/views/session.js',
  'js/views/library.js',
  'js/views/assessment.js',
  'js/views/home.js',
  'js/views/install.js',
  'js/views/settings.js',
  'js/history.js',
  'js/chart.js',
  'js/views/history.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

// Lokalt hentes nyeste fil først, så utvikling ikke henger igjen på gammel cache.
const IS_LOCAL = ['localhost', '127.0.0.1'].includes(self.location.hostname);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function fromCache(request) {
  const cache = await caches.open(CACHE);
  return request.mode === 'navigate'
    ? cache.match('index.html')
    : cache.match(request, { ignoreSearch: true });
}

async function cacheFirst(request) {
  return (await fromCache(request)) ?? fetch(request);
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request.mode === 'navigate' ? 'index.html' : request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await fromCache(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(IS_LOCAL ? networkFirst(request) : cacheFirst(request));
});
