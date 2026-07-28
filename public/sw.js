const CACHE_NAME = "game-panel-cache-v1";

const STATIC_ASSETS = [
    "/manifest.json",
    "/assets/icon-192.png",
    "/assets/icon-512.png",
    "/assets/icon-maskable-512.png"
];

self.addEventListener("install", (event) => {

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );

    self.skipWaiting();

});

self.addEventListener("activate", (event) => {

    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );

    self.clients.claim();

});

self.addEventListener("fetch", (event) => {

    const request = event.request;

    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);

    const isStaticAsset =
        url.pathname.startsWith("/css/") ||
        url.pathname.startsWith("/js/") ||
        url.pathname.startsWith("/assets/") ||
        url.pathname.startsWith("/vendor/") ||
        url.pathname === "/manifest.json";

    if (isStaticAsset) {

        event.respondWith(
            caches.match(request).then((cached) => {

                if (cached) {
                    return cached;
                }

                return fetch(request).then((response) => {

                    const clone = response.clone();

                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, clone);
                    });

                    return response;

                });

            })
        );

        return;

    }

    event.respondWith(
        fetch(request).catch(() => {
            return caches.match(request);
        })
    );

});
