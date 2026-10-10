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

    // Do not reload the page when a Service Worker takes control.
    // Auto-reloading here interrupted users when they opened the login page.
    // The updated worker can take control without forcing a navigation.

}
