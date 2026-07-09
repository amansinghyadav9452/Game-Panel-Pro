if (!localStorage.getItem("token")) {
    window.location.replace("/login");}

if (typeof initSidebar === "function") {
    initSidebar();
}
initAutoLogout();

async function loadStats() {

    try {

const response = await apiFetch("/dashboard");

        const data = await response.json();

if (!data.success) {

    showToast(data.message, "error");

    return;

}

        document.getElementById("totalKeys").textContent =
            data.stats.totalKeys;

        document.getElementById("activeKeys").textContent =
            data.stats.activeKeys;

        document.getElementById("expiredKeys").textContent =
            data.stats.expiredKeys;

        document.getElementById("bannedKeys").textContent =
            data.stats.bannedKeys;

    } catch (err) {

        console.error(err);

    }

}

loadStats();