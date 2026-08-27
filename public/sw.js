// __SW_VERSION__ server route (server.js) dwara request ke time replace
// hota hai (process boot timestamp se). Matlab jab bhi server
// restart/deploy hota hai, cache naam khud badal jaata hai aur neeche
// wala activate handler purana cache khud delete kar deta hai - kisi ko
// manually browsing data clear karne ki zaroorat nahi padti.
const CACHE_NAME = "game-panel-cache-__SW_VERSION__";

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

        // Network-first: hamesha pehle fresh file server se maango, cache
        // ko sirf update rakhne + offline fallback ke liye use karo. Isse
        // naya push turant reflect hota hai. (Pehle cache-first tha, jo
        // purana file hamesha ke liye serve karta rehta tha.)
        event.respondWith(
            fetch(request)
                .then((response) => {

                    const clone = response.clone();

                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, clone);
                    });

                    return response;

                })
                .catch(() => caches.match(request))
        );

        return;

    }

    event.respondWith(
        fetch(request).catch(() => {
            return caches.match(request);
        })
    );

});

// Server se push aane par - app band ho, tab bhi (ya login screen pe
// bhi) OS/device level notification dikhti hai. Login hoke dekhne ki
// zaroorat nahi, bas ye batata hai ki naya message aaya hai.
self.addEventListener("push", (event) => {

    let data = {};

    try {
        data = event.data ? event.data.json() : {};
    } catch (err) {
        data = { title: "Game Panel", body: event.data ? event.data.text() : "New message" };
    }

    const title = data.title || "Game Panel";

    const options = {
        body: data.body || "You received a new message.",
        icon: "/assets/icon-192.png",
        badge: "/assets/icon-192.png",
        data: { url: data.url || "/messenger" },
        tag: "game-panel-chat",
        renotify: true
    };

    event.waitUntil(self.registration.showNotification(title, options));

});

// Notification tap karne par - agar tab already khula hai to usi ko
// focus karo, warna naya tab kholo. "Login to see" wala flow yahi se
// hota hai (user login page/messenger tak pahunch jaata hai).
self.addEventListener("notificationclick", (event) => {

    event.notification.close();

    const targetUrl = (event.notification.data && event.notification.data.url) || "/messenger";

    event.waitUntil(

        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {

            for (const client of clientsList) {

                if ("focus" in client) {
                    client.navigate(targetUrl).catch(() => {});
                    return client.focus();
                }

            }

            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }

        })

    );

});
