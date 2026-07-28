/* Reality Loop Service Worker v2.1 — PWA support */
const CACHE = 'rl-v2.1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/utils.js',
  '/js/db.js',
  '/js/weather.js',
  '/js/chat-provider.js',
  '/js/app.js',
  '/js/dashboard.js',
  '/js/tasks.js',
  '/js/ai-learning.js',
  '/js/english.js',
  '/js/fatloss.js',
  '/js/finance.js',
  '/js/diary.js',
  '/js/chats.js',
  '/manifest.json',
  '/icons/01-daily-plan.png',
  '/icons/02-ai-learning.png',
  '/icons/03-english-learning.png',
  '/icons/04-weight-progress.png',
  '/icons/05-finance-learning.png',
  '/icons/06-diary-empty.png',
  '/icons/07-chats-empty.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request)).catch(() => caches.match('/index.html'))
  );
});
