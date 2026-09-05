if (!localStorage.getItem("token") && !localStorage.getItem("customerToken")) {
    window.location.replace("/login");
}

if (typeof initSidebar === "function") initSidebar();
initAutoLogout();

const __logsRole = (typeof getPanelRole === "function")
    ? getPanelRole()
    : (localStorage.getItem("token") ? "admin" : "customer");

let currentPage = 1;
let allLogs = [];
let bannedDevices = [];
let lastRenderSignature = null;
let activeStatusFilter = "all";
let searchTerm = "";
let sortOrder = "newest";
const limit = 100;

const DEVICE_THEMES = {
    motorola:{className:"motorola",accent:"#D7B56D",accent2:"#7F8A45",glow:"rgba(215,181,109,.30)",bg:"rgba(78,72,39,.34)",pattern:"rings"},
    samsung:{className:"samsung",accent:"#6D8CFF",accent2:"#4BD4FF",glow:"rgba(76,121,255,.30)",bg:"rgba(25,43,92,.34)",pattern:"orbit"},
    nothing:{className:"nothing",accent:"#F1F1E8",accent2:"#E5484D",glow:"rgba(229,72,77,.22)",bg:"rgba(232,232,220,.08)",pattern:"glyphs"},
    vivo:{className:"vivo",accent:"#9B82FF",accent2:"#4DE2FF",glow:"rgba(117,104,255,.30)",bg:"rgba(64,54,126,.34)",pattern:"aurora"},
    oppo:{className:"oppo",accent:"#55D69A",accent2:"#A9E86D",glow:"rgba(57,202,128,.27)",bg:"rgba(31,92,62,.30)",pattern:"leaf"},
    oneplus:{className:"oneplus",accent:"#FF5B5F",accent2:"#C93D4A",glow:"rgba(255,73,79,.28)",bg:"rgba(91,27,34,.30)",pattern:"slash"},
    xiaomi:{className:"xiaomi",accent:"#FF9B54",accent2:"#FFD36A",glow:"rgba(255,137,64,.28)",bg:"rgba(94,52,26,.32)",pattern:"grid"},
    redmi:{className:"redmi",accent:"#FF8B45",accent2:"#FFCF5C",glow:"rgba(255,123,55,.27)",bg:"rgba(91,48,23,.30)",pattern:"grid"},
    realme:{className:"realme",accent:"#D9F43A",accent2:"#8CC63E",glow:"rgba(185,224,44,.26)",bg:"rgba(72,84,20,.30)",pattern:"diagonal"},
    pixel:{className:"pixel",accent:"#76D5FF",accent2:"#A88BFF",glow:"rgba(75,190,255,.28)",bg:"rgba(34,65,92,.30)",pattern:"dots"},
    iqoo:{className:"iqoo",accent:"#FFB45B",accent2:"#FF5C52",glow:"rgba(255,126,61,.28)",bg:"rgba(92,46,25,.30)",pattern:"slash"},
    asus:{className:"asus",accent:"#B8C4D9",accent2:"#7F8CFF",glow:"rgba(125,140,255,.24)",bg:"rgba(56,63,84,.30)",pattern:"tech"},
    huawei:{className:"huawei",accent:"#D5A1FF",accent2:"#FF7B9B",glow:"rgba(204,120,255,.25)",bg:"rgba(76,40,84,.30)",pattern:"wave"},
    honor:{className:"honor",accent:"#7DE4FF",accent2:"#C59CFF",glow:"rgba(88,206,255,.26)",bg:"rgba(32,72,92,.30)",pattern:"crystal"},
    sony:{className:"sony",accent:"#B9C5D6",accent2:"#6689B8",glow:"rgba(104,145,198,.25)",bg:"rgba(48,59,76,.30)",pattern:"lines"},
    nokia:{className:"nokia",accent:"#62C8FF",accent2:"#5477FF",glow:"rgba(70,171,255,.25)",bg:"rgba(28,62,91,.30)",pattern:"wave"},
    generic:{className:"generic",accent:"#B8A7FF",accent2:"#72D6D0",glow:"rgba(133,115,255,.22)",bg:"rgba(55,51,88,.28)",pattern:"constellation"}
};

function normalizeDeviceText(value) {
    return String(value || "").trim().toLowerCase().replace(/[._-]+/g, " ");
}

function detectDeviceTheme(log) {
    const brand = normalizeDeviceText(log?.deviceBrand);
    const marketing = normalizeDeviceText(log?.deviceMarketingName);
    const model = normalizeDeviceText(log?.deviceModel);
    const device = normalizeDeviceText(log?.device);
    const combined = `${brand} ${marketing} ${model} ${device}`;

    const explicitBrand = Object.keys(DEVICE_THEMES)
        .filter(key => key !== "generic")
        .find(name => brand.includes(name));
    if (explicitBrand) return DEVICE_THEMES[explicitBrand];

    const rules = [
        ["motorola", /motorola|moto\b|xt\d/],
        ["samsung", /samsung|galaxy|sm [a-z0-9]/],
        ["nothing", /nothing|a063|a065|a059/],
        ["vivo", /\bvivo\b|\bv\d{2,4}\b/],
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

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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

function formatDate(date) {
    return new Date(date).toLocaleString([], {
        day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"
    });
}

function filteredLogs(logs) {
    let result = logs.slice();
    if (activeStatusFilter !== "all") {
        result = result.filter(log => activeStatusFilter === "success"
            ? log.status === "success"
            : log.status !== "success");
    }
    if (searchTerm) {
        const q = searchTerm.toLowerCase();
        result = result.filter(log => [
            log.licenseKey, log.serial, log.deviceBrand, log.deviceMarketingName,
            log.deviceModel, log.androidVersion, log.appVersion, log.playerName,
            log.licenseType, log.status
        ].some(value => String(value || "").toLowerCase().includes(q)));
    }
    result.sort((a,b) => {
        const diff = new Date(a.createdAt) - new Date(b.createdAt);
        return sortOrder === "oldest" ? diff : -diff;
    });
    return result;
}

function buildBottomNav() {
    return `
        <nav class="logs-bottom-nav" aria-label="Quick navigation">
            <a href="/panel" class="logs-nav-item"><i class="fa-solid fa-house"></i><span>Home</span></a>
            <a href="/logs" class="logs-nav-item active"><i class="fa-solid fa-file-lines"></i><span>Logs</span></a>
            <a href="/activity" class="logs-nav-item"><i class="fa-solid fa-chart-column"></i><span>Analytics</span></a>
            <a href="/settings" class="logs-nav-item"><i class="fa-solid fa-gear"></i><span>Settings</span></a>
            <button type="button" class="logs-fab" id="logsFab" aria-label="Refresh logs"><i class="fa-solid fa-plus"></i></button>
        </nav>`;
}

function renderLogs(data) {
    const container = document.getElementById("userLogsContainer");
    if (!container) return;

    const successLogs = data.logs.filter(log => log.status === "success").length;
    const failedLogs = data.logs.filter(log => log.status !== "success").length;
    const premiumLogs = data.logs.filter(log => String(log.licenseType || "").toLowerCase() === "premium").length;
    const uniqueDevices = new Set(data.logs.map(log => log.serial).filter(Boolean)).size;
    const rangeLabels = {live:"Live", "2h":"Last 2 Hours", "24h":"Last 24 Hours", "7d":"Last 7 Days", "1m":"Last 1 Month"};
    const rangeLabel = rangeLabels[data.range] || "Last 24 Hours";
    const start = ((data.currentPage - 1) * limit) + 1;
    const end = Math.min(data.currentPage * limit, data.totalLogs);
    const visibleLogs = filteredLogs(data.logs);

    let html = `
        <div class="logs-intro">
            <div>
                <div class="logs-kicker">ACTIVITY CENTER</div>
                <div class="logs-subtitle">Track · Analyze · Stay in Control</div>
            </div>
            <div class="logs-signature" aria-hidden="true">Every<br>Login<br>Tells a Story</div>
            <button class="logs-alert" type="button" id="logsAlert" aria-label="Refresh logs" title="Refresh logs"><i class="fa-solid fa-rotate"></i></button>
        </div>

        <div class="logs-stats">
            <div class="stat-card total"><div class="stat-card-icon"><i class="fa-solid fa-database"></i></div><div class="stat-number">${data.totalLogs}</div><div class="stat-label">Total Logs</div><div class="stat-spark"></div></div>
            <div class="stat-card success"><div class="stat-card-icon"><i class="fa-solid fa-circle-check"></i></div><div class="stat-number">${successLogs}</div><div class="stat-label">Successful</div><div class="stat-spark"></div></div>
            <div class="stat-card failed"><div class="stat-card-icon"><i class="fa-solid fa-circle-xmark"></i></div><div class="stat-number">${failedLogs}</div><div class="stat-label">Failed</div><div class="stat-spark"></div></div>
            <div class="stat-card devices"><div class="stat-card-icon"><i class="fa-solid fa-mobile-screen-button"></i></div><div class="stat-number">${uniqueDevices}</div><div class="stat-label">Devices</div><div class="stat-spark"></div></div>
        </div>

        <div class="logs-toolbar">
            <label class="logs-search"><i class="fa-solid fa-magnifying-glass"></i><input id="logsSearch" type="search" autocomplete="off" placeholder="Search by device, model, ID, player..." value="${escapeHtml(searchTerm)}"></label>
            <button class="filter-square" id="logsFilterBtn" type="button" aria-label="Toggle failed filter"><i class="fa-solid fa-filter"></i></button>
        </div>

        <div class="logs-controls">
            <div class="filter-tabs">
                <button class="log-filter ${activeStatusFilter === "all" ? "active" : ""}" data-filter="all"><i class="fa-solid fa-list"></i> All Logs</button>
                <button class="log-filter ${activeStatusFilter === "success" ? "active" : ""}" data-filter="success"><i class="fa-solid fa-circle"></i> Success</button>
                <button class="log-filter ${activeStatusFilter === "failed" ? "active" : ""}" data-filter="failed"><i class="fa-solid fa-circle"></i> Failed</button>
            </div>
            <label class="sort-control" aria-label="Sort logs">
                <i class="fa-solid fa-arrow-down-wide-short" aria-hidden="true"></i>
                <select class="sort-select" id="logsSort" aria-label="Sort logs">
                    <option value="newest" ${sortOrder === "newest" ? "selected" : ""}>Newest</option>
                    <option value="oldest" ${sortOrder === "oldest" ? "selected" : ""}>Oldest</option>
                </select>
                <i class="fa-solid fa-chevron-down sort-chevron" aria-hidden="true"></i>
            </label>
        </div>

        <div class="logs-info"><span>Showing ${start}-${end} of ${data.totalLogs} logs</span><span class="live-indicator"><i></i>${rangeLabel}</span></div>
        <div class="logs-list">
    `;

    if (!visibleLogs.length) {
        html += `<div class="logs-empty"><i class="fa-solid fa-magnifying-glass"></i><strong>No matching logs</strong><span>Try a different search or filter.</span></div>`;
    }

    visibleLogs.forEach((log, index) => {
        const success = log.status === "success";
        const isBanned = bannedDevices.includes(log.serial);
        const theme = detectDeviceTheme(log);
        const licenseType = String(log.licenseType || "public").toLowerCase();
        const deviceName = log.deviceMarketingName || log.deviceBrand || log.deviceModel || "Unknown device";
        const model = log.deviceModel || "—";
        const serial = log.serial || "—";
        const shortId = serial.length > 22 ? `${serial.slice(0, 22)}…` : serial;

        html += `
            <article class="log-card ${success ? "success" : "failed"} device-theme-${theme.className}" style="animation-delay:${index * 35}ms;${themeStyle(theme)}">
                <div class="device-ambient" aria-hidden="true">
                    <span class="ambient-orb"></span><span class="ambient-ring ring-one"></span><span class="ambient-ring ring-two"></span>
                    <span class="ambient-grid"></span><span class="ambient-spark spark-one"></span><span class="ambient-spark spark-two"></span>
                    <div class="device-ghost"><i class="fa-solid fa-mobile-screen-button"></i></div>
                </div>
                <div class="status-line"></div>
                <header class="log-card-head">
                    <button class="device-action" data-serial="${escapeHtml(serial)}" aria-label="Device actions"><i class="fa-solid fa-mobile-screen-button"></i></button>
                    <div class="log-identity">
                        <div class="log-title-row"><h3>${escapeHtml(log.licenseKey || "Untitled license")}</h3><button class="more-btn" type="button" data-serial="${escapeHtml(serial)}" aria-label="More actions"><i class="fa-solid fa-ellipsis-vertical"></i></button></div>
                        <div class="log-uuid"><span>${escapeHtml(shortId)}</span><button class="copy-id" type="button" data-copy="${escapeHtml(serial)}" aria-label="Copy ID"><i class="fa-regular fa-copy"></i></button></div>
                    </div>
                </header>

                <div class="log-status-row">
                    <span class="status-pill ${success ? "success" : "failed"}"><i class="fa-solid ${success ? "fa-circle-check" : "fa-circle-xmark"}"></i>${success ? "Success" : "Failed"}</span>
                    <div class="log-time"><i class="fa-regular fa-clock"></i><span>${escapeHtml(getLastSeen(log.createdAt))}</span><small>${escapeHtml(formatDate(log.createdAt))}</small></div>
                </div>

                <div class="log-body">
                    <div class="device-preview"><div class="preview-glow"></div><i class="fa-solid fa-mobile-screen-button"></i><span>${escapeHtml(deviceName)}</span></div>
                    <div class="meta-panel">
                        <div class="meta-item"><i class="fa-solid fa-mobile-screen-button"></i><div><span>Device</span><strong>${escapeHtml(deviceName)}</strong></div></div>
                        <div class="meta-item"><i class="fa-regular fa-user"></i><div><span>Player</span><strong>${escapeHtml(log.playerName || "—")}</strong></div></div>
                        <div class="meta-item"><i class="fa-brands fa-android"></i><div><span>Android</span><strong>${escapeHtml(log.androidVersion || "—")}</strong></div></div>
                        <div class="meta-item"><i class="fa-solid fa-mobile-screen"></i><div><span>Model</span><strong>${escapeHtml(model)}</strong></div></div>
                        <div class="meta-item"><i class="fa-solid fa-cube"></i><div><span>App Version</span><strong>${escapeHtml(log.appVersion || "—")}</strong></div></div>
                        <div class="meta-item"><i class="fa-solid fa-hashtag"></i><div><span>Log ID</span><strong>${escapeHtml(shortId)}</strong></div><button class="copy-id mini" type="button" data-copy="${escapeHtml(serial)}" aria-label="Copy log ID"><i class="fa-regular fa-copy"></i></button></div>
                    </div>
                </div>

                <div class="log-footer">
                    <button class="details-btn" type="button" data-details="${escapeHtml(serial)}"><i class="fa-regular fa-eye"></i> View Full Details <i class="fa-solid fa-arrow-right"></i></button>
                    <span class="license-badge ${licenseType}"><i class="fa-solid ${licenseType === "premium" ? "fa-crown" : "fa-globe"}"></i>${escapeHtml(log.licenseType || "Public")}</span>
                </div>
                ${isBanned ? `<div class="banned-ribbon"><i class="fa-solid fa-ban"></i> Banned Device</div>` : ""}
                ${!success && log.reason ? `<div class="reason-box"><strong>Reason</strong><span>${escapeHtml(log.reason)}</span></div>` : ""}
            </article>
        `;
    });

    html += `
        </div>
        <div class="logs-pagination">
            <button id="prevBtn" class="page-btn" ${data.currentPage === 1 ? "disabled" : ""}><i class="fa-solid fa-arrow-left"></i> Previous</button>
            <span>Page <strong>${data.currentPage}</strong> of <strong>${data.totalPages || 1}</strong></span>
            <button id="nextBtn" class="page-btn" ${data.currentPage === data.totalPages ? "disabled" : ""}>Next <i class="fa-solid fa-arrow-right"></i></button>
        </div>
        ${buildBottomNav()}
    `;

    container.innerHTML = html;
    bindLogControls(data);
}

function bindLogControls(data) {
    document.getElementById("logsSearch")?.addEventListener("input", e => {
        searchTerm = e.target.value.trim();
        renderLogs(data);
        const input = document.getElementById("logsSearch");
        input?.focus();
        if (input) input.setSelectionRange(searchTerm.length, searchTerm.length);
    });

    document.querySelectorAll(".log-filter").forEach(button => button.addEventListener("click", () => {
        activeStatusFilter = button.dataset.filter || "all";
        renderLogs(data);
    }));

    document.getElementById("logsSort")?.addEventListener("change", e => {
        sortOrder = e.target.value;
        renderLogs(data);
    });

    document.getElementById("logsFilterBtn")?.addEventListener("click", () => {
        activeStatusFilter = activeStatusFilter === "failed" ? "all" : "failed";
        renderLogs(data);
    });

    document.getElementById("logsAlert")?.addEventListener("click", async () => {
        const button = document.getElementById("logsAlert");
        button?.classList.add("is-refreshing");
        try {
            await loadLogs(currentPage);
        } finally {
            button?.classList.remove("is-refreshing");
        }
    });
    document.getElementById("logsFab")?.addEventListener("click", () => loadLogs(currentPage));

    document.querySelectorAll(".device-action,.more-btn").forEach(button => button.addEventListener("click", () => showDeviceMenu(button.dataset.serial)));
    document.querySelectorAll(".copy-id").forEach(button => button.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(button.dataset.copy || "");
            if (typeof showToast === "function") showToast("Copied", "Log ID copied to clipboard.", "success");
        } catch (_) {}
    }));
    document.querySelectorAll(".details-btn").forEach(button => button.addEventListener("click", () => {
        const log = allLogs.find(x => x.serial === button.dataset.details);
        if (!log) return;
        showLogDetails(log);
    }));

    document.getElementById("prevBtn")?.addEventListener("click", () => loadLogs(currentPage - 1));
    document.getElementById("nextBtn")?.addEventListener("click", () => loadLogs(currentPage + 1));
}

function showLogDetails(log) {
    const theme = detectDeviceTheme(log);
    const message = [
        `Device: ${log.deviceMarketingName || log.deviceBrand || log.deviceModel || "Unknown"}`,
        `Model: ${log.deviceModel || "—"}`,
        `Android: ${log.androidVersion || "—"}`,
        `App: ${log.appVersion || "—"}`,
        `Player: ${log.playerName || "—"}`,
        `Status: ${log.status || "—"}`,
        `ID: ${log.serial || "—"}`
    ].join("\n");
    if (typeof showToast === "function") showToast(theme.className.toUpperCase(), message, log.status === "success" ? "success" : "error");
}

async function loadLogs(page = currentPage, isAutoRefresh = false) {
    currentPage = page;
    const container = document.getElementById("userLogsContainer");
    if (container && !isAutoRefresh && window.GPLoading) GPLoading.show(container, "logs");

    try {
        const isCustomer = __logsRole === "customer";
        const token = localStorage.getItem(isCustomer ? "customerToken" : "token");
        const logsUrl = isCustomer
            ? `/customer/logs/activity?page=${page}&limit=${limit}`
            : `/logs/recent?page=${page}&limit=${limit}`;

        const response = await fetch(logsUrl, {headers:{Authorization:`Bearer ${token}`}});
        const data = await response.json();

        if (isCustomer) {
            bannedDevices = [];
        } else {
            const bannedResponse = await fetch("/api/banned-devices", {headers:{Authorization:`Bearer ${localStorage.getItem("token")}`}});
            const bannedData = await bannedResponse.json();
            bannedDevices = Array.isArray(bannedData) ? bannedData.map(device => device.serial) : [];
        }

        if (!data.success) {
            container.innerHTML = `<div class="logs-error"><i class="fa-solid fa-triangle-exclamation"></i><strong>Failed to load logs.</strong></div>`;
            return;
        }

        allLogs = Array.isArray(data.logs) ? data.logs : [];
        if (!allLogs.length) {
            container.innerHTML = `<div class="logs-empty"><i class="fa-regular fa-folder-open"></i><strong>No logs found</strong><span>There is nothing to display for the selected range.</span></div>`;
            return;
        }

        const signature = JSON.stringify({page:data.currentPage,banned:bannedDevices,logs:allLogs.map(l => `${l.serial}-${l.status}-${l.createdAt}`)});
        if (isAutoRefresh && signature === lastRenderSignature) return;
        lastRenderSignature = signature;
        renderLogs(data);
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="logs-error"><i class="fa-solid fa-server"></i><strong>Server Error.</strong><span>Unable to load user logs.</span></div>`;
    }
}

function showDeviceMenu(serial) {
    const log = allLogs.find(x => x.serial === serial);
    if (log) openBanModal(log);
}

function openBanModal(log) {
    const deviceLabel = log.deviceMarketingName || log.deviceModel || "this device";
    showBanModal(deviceLabel, reason => banDevice(log.serial, reason));
}

async function banDevice(serial, reason = "") {
    try {
        if (__logsRole === "customer") {
            showToast("Restricted", "Sorry, it's allowed only to the admin.", "error");
            return;
        }
        const log = allLogs.find(x => x.serial === serial);
        if (!log) {
            showToast("Device not found", "error");
            return;
        }
        const response = await fetch("/api/banned-devices/ban", {
            method:"POST",
            headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("token")}`},
            body:JSON.stringify({serial:log.serial,userKey:log.licenseKey,deviceBrand:log.deviceBrand,deviceModel:log.deviceModel,androidVersion:log.androidVersion,appVersion:log.appVersion,playerName:log.playerName,bannedBy:"Admin",reason:reason || "No reason provided"})
        });
        const data = await response.json();
        if (data.success) {
            showToast("Device banned successfully", "success");
            await loadLogs(currentPage);
        } else showToast(data.message, "error");
    } catch (e) {
        showToast("Unable to ban device", "error");
    }
}

loadLogs(1);

setInterval(() => {
    if (document.visibilityState !== "visible") return;
    loadLogs(currentPage, true);
}, 10000);
