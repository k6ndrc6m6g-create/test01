// Service Worker: hält die App vollständig offline verfügbar.
// Bei Änderungen an Dateien VERSION erhöhen, damit Geräte die neue Fassung laden.
const VERSION = 'v3';
const CACHE = `europa-${VERSION}`;
const FLAGS = 'al ad be by ba bg dk de ee fi fr gr ie is it xk hr lv li lt lu mt md mc me nl mk no at pl pt ro ru sm se ch rs sk si es cz tr ua hu va gb cy'.split(' ');
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/app.js',
  'js/map.js',
  'js/answer.js',
  'js/questions.js',
  'js/storage.js',
  'js/haptics.js',
  'js/data/countries.js',
  'js/data/map.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  ...FLAGS.map((code) => `flags/${code}.svg`),
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  // Nur eigene, veraltete Caches löschen – die andere App unter derselben Adresse hat ihre eigenen.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('europa-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request)),
  );
});
