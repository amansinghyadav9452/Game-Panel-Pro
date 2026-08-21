function setBadge(id, text, level) {

    const badge = document.getElementById(id);

    if (!badge) return;

    badge.textContent = text;

    badge.classList.remove("active", "warning", "danger");

    badge.classList.add(level);

    const card = badge.closest(".status-card");

    if (card) {

        card.classList.remove("status-online", "status-warn", "status-off");

        card.classList.add(
            level === "active"
                ? "status-online"
                : level === "warning"
                    ? "status-warn"
                    : "status-off"
        );

    }

}

function setDesc(id, text) {

    const el = document.getElementById(id);

    if (el) el.textContent = text;

}

async function loadSecurityStatus() {

    const token = localStorage.getItem("token");

    try {

        const res = await fetch("/settings/status", {

            headers: {
                Authorization: `Bearer ${token}`
            }

        });

        const data = await res.json();

        if (!data.success) return;

        setBadge(
            "jwtBadge",
            data.jwt.active ? "Active" : "Inactive",
            data.jwt.active ? "active" : "danger"
        );

        setDesc(
            "jwtDesc",
            `Secure login tokens enabled (expires in ${data.jwt.expiry})`
        );

        setBadge("hashingBadge", data.passwordHashing.algorithm, "active");

        setDesc(
            "hashingDesc",
            `${data.passwordHashing.saltRounds} Salt Rounds`
        );

        setBadge(
            "httpsBadge",
            data.https.enabled ? "Enabled" : "Disabled",
            data.https.enabled ? "active" : "warning"
        );

        setDesc(
            "httpsDesc",
            data.https.enabled
                ? "Encrypted HTTPS connection"
                : "Not running behind HTTPS"
        );

        setBadge(
            "helmetBadge",
            data.helmet.enabled ? "Enabled" : "Disabled",
            data.helmet.enabled ? "active" : "danger"
        );

        setBadge(
            "rateLimitBadge",
            data.rateLimiter.active ? "Active" : "Inactive",
            data.rateLimiter.active ? "active" : "danger"
        );

        setDesc(
            "rateLimitDesc",
            `${data.rateLimiter.limit} requests / ${data.rateLimiter.windowMinutes} minute`
        );

        setBadge(
            "corsBadge",
            data.cors.restricted ? "Restricted" : "Open",
            data.cors.restricted ? "active" : "warning"
        );

        setDesc(
            "corsDesc",
            data.cors.restricted
                ? "Allowed origins only"
                : "All origins allowed"
        );

        setBadge(
            "headersBadge",
            data.securityHeaders.applied ? "Applied" : "Missing",
            data.securityHeaders.applied ? "active" : "danger"
        );

        const isProd = data.environment === "production";

        setBadge(
            "envBadge",
            isProd ? "Production" : "Development",
            isProd ? "active" : "warning"
        );

        setDesc(
            "envDesc",
            isProd
                ? "Running in production mode"
                : "Production mode recommended"
        );

    }

    catch (error) {

        console.error(error);

    }

}

loadSecurityStatus();

setInterval(() => {

    if (document.visibilityState !== "visible") return;

    loadSecurityStatus();

}, 15000);
