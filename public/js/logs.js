if (!localStorage.getItem("token") && !localStorage.getItem("customerToken")) {

    window.location.replace("/login");

}

if (typeof initSidebar === "function") {

    initSidebar();

}

initAutoLogout();

const __logsRole = (typeof getPanelRole === "function") ? getPanelRole() : (localStorage.getItem("token") ? "admin" : "customer");
let currentPage = 1;
let allLogs = [];
let bannedDevices = [];
let lastRenderSignature = null;
const limit = 100;

/*
 * Device-aware visual system.
 * Uses the backend's deviceBrand first, then marketing/model strings as a
 * fallback. The renderer only changes presentation; log data and actions
 * remain untouched.
 */
const DEVICE_THEMES = {
    motorola: {
        className: "motorola",
        accent: "#D7B56D",
        accent2: "#7F8A45",
        glow: "rgba(215,181,109,.30)",
        bg: "rgba(78,72,39,.34)",
        pattern: "rings"
    },
    samsung: {
        className: "samsung",
        accent: "#6D8CFF",
        accent2: "#4BD4FF",
        glow: "rgba(76,121,255,.30)",
        bg: "rgba(25,43,92,.34)",
        pattern: "orbit"
    },
    nothing: {
        className: "nothing",
        accent: "#F1F1E8",
        accent2: "#E5484D",
        glow: "rgba(229,72,77,.22)",
        bg: "rgba(232,232,220,.08)",
        pattern: "glyphs"
    },
    vivo: {
        className: "vivo",
        accent: "#9B82FF",
        accent2: "#4DE2FF",
        glow: "rgba(117,104,255,.30)",
        bg: "rgba(64,54,126,.34)",
        pattern: "aurora"
    },
    oppo: {
        className: "oppo",
        accent: "#55D69A",
        accent2: "#A9E86D",
        glow: "rgba(57,202,128,.27)",
        bg: "rgba(31,92,62,.30)",
        pattern: "leaf"
    },
    oneplus: {
        className: "oneplus",
        accent: "#FF5B5F",
        accent2: "#C93D4A",
        glow: "rgba(255,73,79,.28)",
        bg: "rgba(91,27,34,.30)",
        pattern: "slash"
    },
    xiaomi: {
        className: "xiaomi",
        accent: "#FF9B54",
        accent2: "#FFD36A",
        glow: "rgba(255,137,64,.28)",
        bg: "rgba(94,52,26,.32)",
        pattern: "grid"
    },
    redmi: {
        className: "redmi",
        accent: "#FF8B45",
        accent2: "#FFCF5C",
        glow: "rgba(255,123,55,.27)",
        bg: "rgba(91,48,23,.30)",
        pattern: "grid"
    },
    realme: {
        className: "realme",
        accent: "#D9F43A",
        accent2: "#8CC63E",
        glow: "rgba(185,224,44,.26)",
        bg: "rgba(72,84,20,.30)",
        pattern: "diagonal"
    },
    pixel: {
        className: "pixel",
        accent: "#76D5FF",
        accent2: "#A88BFF",
        glow: "rgba(75,190,255,.28)",
        bg: "rgba(34,65,92,.30)",
        pattern: "dots"
    },
    iqoo: {
        className: "iqoo",
        accent: "#FFB45B",
        accent2: "#FF5C52",
        glow: "rgba(255,126,61,.28)",
        bg: "rgba(92,46,25,.30)",
        pattern: "slash"
    },
    asus: {
        className: "asus",
        accent: "#B8C4D9",
        accent2: "#7F8CFF",
        glow: "rgba(125,140,255,.24)",
        bg: "rgba(56,63,84,.30)",
        pattern: "tech"
    },
    huawei: {
        className: "huawei",
        accent: "#D5A1FF",
        accent2: "#FF7B9B",
        glow: "rgba(204,120,255,.25)",
        bg: "rgba(76,40,84,.30)",
        pattern: "wave"
    },
    honor: {
        className: "honor",
        accent: "#7DE4FF",
        accent2: "#C59CFF",
        glow: "rgba(88,206,255,.26)",
        bg: "rgba(32,72,92,.30)",
        pattern: "crystal"
    },
    sony: {
        className: "sony",
        accent: "#B9C5D6",
        accent2: "#6689B8",
        glow: "rgba(104,145,198,.25)",
        bg: "rgba(48,59,76,.30)",
        pattern: "lines"
    },
    nokia: {
        className: "nokia",
        accent: "#62C8FF",
        accent2: "#5477FF",
        glow: "rgba(70,171,255,.25)",
        bg: "rgba(28,62,91,.30)",
        pattern: "wave"
    },
    generic: {
        className: "generic",
        accent: "#B8A7FF",
        accent2: "#72D6D0",
        glow: "rgba(133,115,255,.22)",
        bg: "rgba(55,51,88,.28)",
        pattern: "constellation"
    }
};

function normalizeDeviceText(value) {
    return String(value || "").trim().toLowerCase().replace(/[._-]+/g, " ");
}

function detectDeviceTheme(log) {
    const brand = normalizeDeviceText(log?.deviceBrand);
    const marketing = normalizeDeviceText(log?.deviceMarketingName);
    const model = normalizeDeviceText(log?.deviceModel);
    const combined = `${brand} ${marketing} ${model}`;

    // Prefer an explicit backend brand over model-prefix heuristics.
    const explicitBrand = [
        "motorola", "samsung", "nothing", "vivo", "oppo", "oneplus",
        "xiaomi", "redmi", "realme", "pixel", "iqoo", "asus", "huawei",
        "honor", "sony", "nokia"
    ].find(name => brand.includes(name));

    if (explicitBrand) {
        return DEVICE_THEMES[explicitBrand];
    }

    const rules = [
        ["motorola", /motorola|moto\b|xt\d/],
        ["samsung", /samsung|galaxy|sm [a-z0-9]/],
        ["nothing", /nothing|a063|a065|a059/],
        ["vivo", /\bvivo\b|v\d{2,4}/],
        ["oppo", /\boppo\b|cph\d/],
        ["oneplus", /oneplus|one plus|in\d{3,5}/],
        ["redmi", /redmi/],
        ["xiaomi", /xiaomi|mi \d|mix|poco/],
        ["realme", /realme|rmx\d/],
        ["pixel", /google|pixel/],
        ["iqoo", /iqoo/],
        ["asus", /asus|rog phone|zenfone/],
        ["huawei", /huawei/],
        ["honor", /honor/],
        ["sony", /sony|xperia/],
        ["nokia", /nokia/]
    ];

    const match = rules.find(([, pattern]) => pattern.test(combined));
    return DEVICE_THEMES[match ? match[0] : "generic"];
}

function themeStyle(theme) {
    return [
        `--device-accent:${theme.accent}`,
        `--device-accent-2:${theme.accent2}`,
        `--device-glow:${theme.glow}`,
        `--device-bg:${theme.bg}`
    ].join(";");
}

function getLastSeen(date) {

    const seconds = Math.floor((Date.now() - new Date(date)) / 1000);

    if (seconds < 10) return "Just now";

    if (seconds < 60) return `${seconds} sec ago`;

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);

    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;

    const days = Math.floor(hours / 24);

    if (days === 1) return "Yesterday";

    if (days < 7) return `${days} days ago`;

    return new Date(date).toLocaleString();

}

async function loadLogs(page = currentPage, isAutoRefresh = false) {

    currentPage = page;

    const container =
        document.getElementById("userLogsContainer");

    if (container && !isAutoRefresh && window.GPLoading) {
        GPLoading.show(container, "logs");
    }

    try {

        const isCustomer = __logsRole === "customer";

        const token =
            localStorage.getItem(isCustomer ? "customerToken" : "token");

        const logsUrl = isCustomer
            ? `/customer/logs/activity?page=${page}&limit=${limit}`
            : `/logs/recent?page=${page}&limit=${limit}`;

        const response = await fetch(logsUrl, {

            headers: {

                Authorization: `Bearer ${token}`

            }

        });

        const data = await response.json();

        // Banned-devices is an admin-only, panel-wide list - customers
        // don't get a banned indicator on their own logs view.
        if (isCustomer) {

            bannedDevices = [];

        } else {

            const bannedResponse = await fetch("/api/banned-devices", {

                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                }

            });

            const bannedData = await bannedResponse.json();

            bannedDevices = bannedData.map(device => device.serial);

        }

        allLogs = data.logs;

        const successLogs = data.logs.filter(
    log => log.status === "success"
).length;

const failedLogs = data.logs.filter(
    log => log.status !== "success"
).length;

const premiumLogs = data.logs.filter(
    log => (log.licenseType || "").toLowerCase() === "premium"
).length;

const uniqueDevices = new Set(
    data.logs.map(log => log.serial)
).size;

        if (!data.success) {

            container.innerHTML =
                `<p style="color:#EF4444;">Failed to load logs.</p>`;

            return;

        }

        if (data.logs.length === 0) {

            container.innerHTML =
                `<p style="color:#94A3B8;">No logs found.</p>`;

            return;

        }

        const signature = JSON.stringify({
            page: data.currentPage,
            banned: bannedDevices,
            logs: data.logs.map(l => `${l.serial}-${l.status}-${l.createdAt}`)
        });

        if (isAutoRefresh && signature === lastRenderSignature) {
            return;
        }

        lastRenderSignature = signature;

        const start = ((data.currentPage - 1) * limit) + 1;

        const end = Math.min(
            data.currentPage * limit,
            data.totalLogs
        );

        const rangeLabels = {
            live: "Live",
            "2h": "Last 2 Hours",
            "24h": "Last 24 Hours",
            "7d": "Last 7 Days",
            "1m": "Last 1 Month"
        };

        const rangeLabel = rangeLabels[data.range] || "Last 24 Hours";

let html = `

<div class="logs-stats">

    <div class="stat-card success">

        <div class="stat-number">

            ${successLogs}

        </div>

        <div class="stat-label">

            Success

        </div>

    </div>

    <div class="stat-card failed">

        <div class="stat-number">

            ${failedLogs}

        </div>

        <div class="stat-label">

            Failed

        </div>

    </div>

    <div class="stat-card premium">

        <div class="stat-number">

            ${premiumLogs}

        </div>

        <div class="stat-label">

            Premium

        </div>

    </div>

    <div class="stat-card devices">

        <div class="stat-number">

            ${uniqueDevices}

        </div>

        <div class="stat-label">

            Devices

        </div>

    </div>

</div>

<div class="logs-info">

    Showing ${start}-${end} of ${data.totalLogs} logs · ${rangeLabel}

</div>

<div class="logs-list">

`;

        data.logs.forEach((log, index) => {
const success = log.status === "success";

const isBanned = bannedDevices.includes(log.serial);
const deviceTheme = detectDeviceTheme(log);

html += `

<div class="log-card ${success ? "success" : "failed"} device-theme-${deviceTheme.className}" style="animation-delay:${index * 45}ms;${themeStyle(deviceTheme)}" data-device-brand="${log.deviceBrand || ""}">

    <div class="device-ambient" aria-hidden="true">
    <span class="ambient-orb"></span>
    <span class="ambient-ring ring-one"></span>
    <span class="ambient-ring ring-two"></span>
    <span class="ambient-grid"></span>
    <span class="ambient-spark spark-one"></span>
    <span class="ambient-spark spark-two"></span>
</div>

<div class="status-line"></div>

<div class="log-top">

<div
    class="device-action"
    data-serial="${log.serial}">

    <i class="fa-solid fa-mobile-screen-button"></i>

</div>

    <div class="log-title">

<div class="top-row">

    <h3>${log.licenseKey}</h3>

<span class="status-pill ${success ? "success" : "failed"}">

    ${success ? "Success" : "Failed"}

</span>

${
    isBanned
        ? `<span class="status-pill failed" title="This device's serial is currently in the banned list">🚫 Banned Device</span>`
        : ""
}

</div>

<div class="bottom-row">

    <span class="time">

        🕒 ${getLastSeen(log.createdAt)}

    </span>

    <span class="license-badge ${log.licenseType.toLowerCase()}">

        ${log.licenseType}

    </span>

</div>

    </div>

</div>

<div class="log-meta">

    ${(log.deviceMarketingName || log.deviceBrand) ? `
    <div class="meta-row">
        <span class="meta-label">
            Device :
        </span>
        <span class="meta-value">
            ${log.deviceMarketingName || [log.deviceBrand, log.deviceModel].filter(Boolean).join(" ") || "-"}
        </span>
    </div>
    ` : ""}

        ${log.androidVersion ? `
    <div class="meta-row">
        <span class="meta-label">
            Android :
        </span>
        <span class="meta-value">
            ${log.androidVersion}
        </span>
    </div>
    ` : ""}

    ${log.appVersion ? `
<div class="meta-row">
    <span class="meta-label">
        App :
    </span>
    <span class="meta-value">
        ${log.appVersion}
    </span>
</div>
` : ""}

    ${log.playerName ? `
<div class="meta-row">
    <span class="meta-label">
        Player :
    </span>
    <span class="meta-value">
        ${log.playerName}
    </span>
</div>
` : ""}

    ${log.deviceModel ? `
    <div class="meta-row">
        <span class="meta-label">
            Model :
        </span>
        <span class="meta-value">
            ${log.deviceModel}
        </span>
    </div>
    ` : ""}

        <div class="meta-row">
        <span class="meta-label">
            ID :
        </span>
        <span class="meta-value">
            ${log.serial || "-"}
        </span>
    </div>

    ${!success && log.reason ? `

    <div class="meta-row reason">

        ${log.reason}

    </div>

    ` : ""}

</div>

</div>

`;

        });

html += `

</div>

<div class="logs-pagination">

    <button
        id="prevBtn"
        class="page-btn"
        ${data.currentPage === 1 ? "disabled" : ""}>

        ← Previous

    </button>

    <span class="page-number">

        Page ${data.currentPage} of ${data.totalPages}

    </span>

    <button
        id="nextBtn"
        class="page-btn"
        ${data.currentPage === data.totalPages ? "disabled" : ""}>

        Next →

    </button>

</div>
`;

        container.innerHTML = html;

        container.querySelectorAll(".device-action")
.forEach(button => {

    button.addEventListener("click", () => {

        showDeviceMenu(
            button.dataset.serial
        );

    });

});

        const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

if (prevBtn && !prevBtn.disabled) {

    prevBtn.addEventListener("click", () => {

        loadLogs(currentPage - 1);

    });

}

if (nextBtn && !nextBtn.disabled) {

    nextBtn.addEventListener("click", () => {

        loadLogs(currentPage + 1);

    });

}

    } catch (err) {

        console.error(err);

        container.innerHTML =
            `<p style="color:#EF4444;">Server Error.</p>`;

    }

}

function showDeviceMenu(serial){

    const log = allLogs.find(x => x.serial === serial);

    if(!log){
        return;
    }

    openBanModal(log);

}

function openBanModal(log){

    const deviceLabel =
        log.deviceMarketingName || log.deviceModel || "this device";

    showBanModal(deviceLabel, (reason) => {

        banDevice(log.serial, reason);

    });

}

async function banDevice(serial, reason = ""){

    try{

        if (__logsRole === "customer") {

            showToast("Restricted", "Sorry, it's allowed only to the admin.", "error");

            return;

        }

        const log = allLogs.find(
            x => x.serial === serial
        );

        if(!log){

            showToast(
                "Device not found",
                "error"
            );

            return;

        }

        const response = await fetch(
            "/api/banned-devices/ban",
            {

                method:"POST",
            headers:{

                "Content-Type":"application/json",

                Authorization:`Bearer ${localStorage.getItem("token")}`

            },

                body:JSON.stringify({

                    serial:log.serial,

                    userKey:log.licenseKey,

                    deviceBrand:log.deviceBrand,

                    deviceModel:log.deviceModel,

                    androidVersion:log.androidVersion,

                    appVersion:log.appVersion,

                    playerName:log.playerName,

                    bannedBy:"Admin",

                    reason:reason || "No reason provided"

                })

            }
        );

        const data = await response.json();

        if(data.success){

            showToast(
                "Device banned successfully",
                "success"
            );

            await loadLogs(currentPage);

        }else{

            showToast(
                data.message,
                "error"
            );

        }

    }catch(e){

        showToast(
            "Unable to ban device",
            "error"
        );

    }

}

loadLogs(1);

setInterval(() => {

    // Don't poll while the tab/app is backgrounded — no point re-rendering
    // a list nobody is looking at, and it avoids a burst of layout work
    // the moment the user comes back to the app.
    if (document.visibilityState !== "visible") return;

    loadLogs(currentPage, true);

}, 10000);