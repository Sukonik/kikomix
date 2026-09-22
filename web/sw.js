/* KikoMix service worker — offline app shell.
 * Cache name: kikomix-v3. Install caches the shell best-effort (sibling
 * agents' files may not exist yet, so individual failures are skipped).
 * Fetch: cache-first for GET same-origin, fallback to network (and cache
 * successful GETs for next time). Activate: delete old caches. */
var CACHE = 'kikomix-v3';

var SHELL = [
  './',
  'index.html',
  'manifest.json',
  'css/tokens.css',
  'css/base.css',
  'css/components.css',
  'css/features.css',
  'css/layout.css',
  'css/playerbar.css',
  'js/data.js',
  'js/adapters.js',
  'js/ui.js',
  'js/search.js',
  'js/player.js',
  'js/library.js',
  'js/mixes.js',
  'js/sources.js',
  'js/liondavid.js',
  'js/mimicry.js',
  'js/solarflare.js',
  'js/techniques.js',
  'js/app.js',
  'js/brand.js',
  'assets/brand/logo-primary.jpg',
  'assets/brand/logotype.jpg',
  'icons/dark/icon-192.png',
  'icons/dark/icon-512.png',
  'icons/dark/icon-maskable-512.png',
  'icons/dark/favicon-32.png',
  'icons/dark/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(
        SHELL.map(function (url) {
          return fetch(url, { cache: 'no-cache' }).then(function (res) {
            if (res && res.ok) return cache.put(url, res);
          }).catch(function () {
            /* Not written yet or unreachable — skip, don't fail install. */
          });
        })
      );
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return; // same-origin only
  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      });
    })
  );
});
