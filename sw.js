/* MultipliKids — service worker. Stratégie RÉSEAU D'ABORD :
   on sert toujours la dernière version en ligne, et on garde une copie en
   cache uniquement pour le mode hors-ligne. (Évite de rester bloqué sur une
   vieille version mise en cache.) */
const CACHE = 'multiplikids-v4';
const ASSETS = ['./', 'index.html', 'manifest.json'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS).catch(function () {}); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  // RÉSEAU D'ABORD : on tente le réseau, on met à jour le cache, repli sur le cache hors-ligne
  e.respondWith(
    fetch(e.request).then(function (resp) {
      const copy = resp.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); }).catch(function () {});
      return resp;
    }).catch(function () {
      return caches.match(e.request).then(function (hit) { return hit || caches.match('index.html'); });
    })
  );
});
