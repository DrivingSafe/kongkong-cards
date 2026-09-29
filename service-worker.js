const CACHE = "kongkong-cards-v6";
const APP_FILES = ["./", "./index.html", "./css/style.css", "./js/cards.js", "./js/app.js", "./manifest.webmanifest", "./icons/icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

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
  // 그림: 캐시로 바로 보여 주고, 뒤에서 새 파일로 캐시를 갱신 (그림이 바뀌어도 다음번엔 새 그림)
  if (url.origin === location.origin && url.pathname.includes("/img/")) {
    event.respondWith(caches.match(request).then(cached => {
      const fresh = fetch(request).then(save).catch(() => cached);
      if (cached) { event.waitUntil(fresh); return cached; }
      return fresh;
    }));
    return;
  }
  // 앱 파일: 항상 서버에 새 버전이 있는지 확인(no-cache), 오프라인이면 캐시 사용
  const same = url.origin === location.origin;
  const load = request.mode === "navigate" ? fetch(request.url, { cache: "no-cache", credentials: "same-origin" })
    : same ? fetch(request, { cache: "no-cache" }) : fetch(request);
  event.respondWith(load.then(save).catch(() => caches.match(request).then(hit => hit || caches.match("./index.html"))));
});
