const CACHE = "kongkong-cards-v5";
const APP_FILES = ["./", "./index.html", "./css/style.css", "./js/cards.js", "./js/app.js", "./manifest.webmanifest", "./icons/icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

// 그림(img/)은 캐시 우선, 앱 파일은 네트워크 우선(업데이트가 바로 반영되도록)
self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const save = response => {
    if (response.ok && url.origin === location.origin) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
    }
    return response;
  };
  if (url.origin === location.origin && url.pathname.includes("/img/")) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(save)));
    return;
  }
  event.respondWith(fetch(request).then(save).catch(() => caches.match(request)));
});
