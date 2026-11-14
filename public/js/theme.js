const ACCENT_COLORS = {
    blue: { base: "#3B82F6", dark: "#2563EB" },
    purple: { base: "#8B5CF6", dark: "#7C3AED" },
    green: { base: "#22C55E", dark: "#16A34A" },
    orange: { base: "#F97316", dark: "#EA580C" },
    red: { base: "#EF4444", dark: "#DC2626" }
};

function applyAppearanceSettings(settings) {

    if (!settings) return;

    const html = document.documentElement;

    html.classList.toggle("light-theme", settings.darkMode === false);

    const accent =
        ACCENT_COLORS[settings.accentColor] || ACCENT_COLORS.blue;

    html.style.setProperty("--accent", accent.base);
    html.style.setProperty("--accent-dark", accent.dark);

    html.classList.toggle("sidebar-collapsed", !!settings.sidebarCollapsed);

    html.classList.toggle("no-animations", settings.animationsEnabled === false);

    try {

        localStorage.setItem("panelAppearance", JSON.stringify(settings));

    }

    catch (error) {

        console.error(error);

    }

}

window.applyAppearanceSettings = applyAppearanceSettings;

(function applyCachedAppearance() {

    try {

        const cached = JSON.parse(localStorage.getItem("panelAppearance"));

        if (cached) applyAppearanceSettings(cached);

    }

    catch (error) {

        console.error(error);

    }

})();

(async function loadAppearanceSettings() {

    const token = localStorage.getItem("token");

    if (!token) return;

    try {

        const response = await fetch("/settings/appearance/current", {

            headers: {
                Authorization: `Bearer ${token}`
            }

        });

        const data = await response.json();

        if (data.success) {

            applyAppearanceSettings(data.appearance);

        }

    }

    catch (error) {

        console.error(error);

    }

})();
