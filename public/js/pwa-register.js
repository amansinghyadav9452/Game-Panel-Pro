if ("serviceWorker" in navigator) {

    window.addEventListener("load", () => {

        navigator.serviceWorker
            .register("/sw.js")
            .then((registration) => {

                // Lambi khuli tabs bhi update pakad len, isliye har 5
                // min background me naye sw.js ke liye check karte raho.
                setInterval(() => {
                    registration.update().catch(() => {});
                }, 5 * 60 * 1000);

            })
            .catch((err) => {
                console.error("Service worker registration failed:", err);
            });

    });

    // Naya service worker activate hote hi (sw.js me skipWaiting +
    // clients.claim() already set hai) yeh event fire hota hai - page
    // ko ek baar apne aap refresh kar do taaki naya update turant dikhe,
    // bina user ko kuch manually karna pade.
    let refreshed = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {

        if (refreshed) return;
        refreshed = true;

        window.location.reload();

    });

}
