if (!localStorage.getItem("token") && !localStorage.getItem("customerToken")) {
    window.location.replace("/login");
}

if (typeof initSidebar === "function") initSidebar();
initAutoLogout();

const __dashRole = (typeof getPanelRole === "function")
    ? getPanelRole()
    : (localStorage.getItem("token") ? "admin" : "customer");

const numberFormat = new Intl.NumberFormat("en-IN");

async function loadStats() {
    try {
        const response = await apiFetch(__dashRole === "customer" ? "/customer/dashboard/stats" : "/dashboard");
        const data = await response.json();
        if (!data.success) {
            showToast("Error", data.message, "error");
            stopStatSkeletons();
            return;
        }
        animateCounter(document.getElementById("totalKeys"), data.stats.totalKeys);
        animateCounter(document.getElementById("activeKeys"), data.stats.activeKeys);
        animateCounter(document.getElementById("expiredKeys"), data.stats.expiredKeys);
        animateCounter(document.getElementById("bannedKeys"), data.stats.bannedKeys);
    } catch (err) {
        console.error("Dashboard stats error:", err);
        stopStatSkeletons();
    }
}

function stopStatSkeletons() {
    ["totalKeys", "activeKeys", "expiredKeys", "bannedKeys"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove("gp-skeleton");
        if (el.textContent.trim() === "0" || el.textContent.trim() === "") el.textContent = "—";
    });
}

loadStats();

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
}

async function loadRecentActivities() {
    try {
        const response = await apiFetch(__dashRole === "customer" ? "/customer/dashboard/recent-activity" : "/activity/recent");
        const data = await response.json();
        const container = document.getElementById("recentActivityList");
        if (!container) return;
        const activities = Array.isArray(data.activities) ? data.activities : [];
        if (!data.success || activities.length === 0) {
            container.innerHTML = '<p class="activity-empty">No recent activity yet.</p>';
            return;
        }

        const actionMap = {
            CREATE: { icon: "fa-solid fa-layer-group", text: "Public Key Created", tone: "created", badge: "Created" },
            DELETE: { icon: "fa-regular fa-trash-can", text: "Key Deleted", tone: "deleted", badge: "Deleted" },
            BAN: { icon: "fa-solid fa-ban", text: "Key Banned", tone: "banned", badge: "Banned" },
            UNBAN: { icon: "fa-solid fa-key", text: "Key Unbanned", tone: "unbanned", badge: "Unbanned" },
            EXTEND: { icon: "fa-regular fa-calendar-check", text: "License Extended", tone: "created", badge: "Extended" },
            RESET_DEVICE: { icon: "fa-solid fa-mobile-screen-button", text: "Device Reset", tone: "created", badge: "Reset" }
        };

        container.innerHTML = activities.map(activity => {
            const action = actionMap[activity.action] || {
                icon: "fa-regular fa-circle-check", text: String(activity.action || "Activity"), tone: "created", badge: "Updated"
            };
            const title = activity.action === "CREATE"
                ? (activity.licenseType === "premium" ? "Premium Key Created" : "Key Created")
                : action.text;
            const date = activity.createdAt ? new Date(activity.createdAt) : null;
            const dateText = date && !Number.isNaN(date.getTime())
                ? date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                : "";
            return `
                <article class="activity-item activity-${action.tone}">
                    <span class="activity-icon"><i class="${action.icon}" aria-hidden="true"></i></span>
                    <span class="activity-accent" aria-hidden="true"></span>
                    <div class="activity-copy">
                        <strong class="activity-title">${escapeHTML(title)}</strong>
                        <span class="activity-key">${escapeHTML(activity.licenseKey || "—")}</span>
                        <span class="activity-meta">By ${escapeHTML(activity.admin || "System")}${dateText ? ` <span aria-hidden="true">·</span> ${escapeHTML(dateText)}` : ""}</span>
                    </div>
                    <span class="activity-badge">${escapeHTML(action.badge)}</span>
                </article>`;
        }).join("");
    } catch (err) {
        console.error("Dashboard recent activity error:", err);
        const container = document.getElementById("recentActivityList");
        if (container) container.innerHTML = '<p class="activity-empty">Unable to load recent activity.</p>';
    }
}

loadRecentActivities();

function formatDayLabel(dayKey, compact = false) {
    const date = new Date(`${dayKey}T00:00:00Z`);
    return new Intl.DateTimeFormat("en-IN", compact
        ? { day: "numeric", month: "short", timeZone: "UTC" }
        : { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

function renderUserActivity(data) {
    const chart = document.getElementById("userActivityChart");
    const note = document.getElementById("activityDataNote");
    if (!chart) return;

    const days = Array.isArray(data.days) ? data.days : [];
    const valid = days.map((day, index) => ({
        index,
        value: day.requests === null || day.requests === undefined
            ? null
            : Math.max(0, Number(day.requests) || 0),
        dayKey: day.dayKey
    }));
    const tracked = valid.filter(point => point.value !== null);
    const hasData = tracked.length > 0;
    const firstTrackedIndex = hasData ? tracked[0].index : 0;

    // Keep a real chart footprint even before the first request arrives.
    // Once tracking has begun, missing daily documents represent zero requests.
    const plotPoints = hasData
        ? valid.filter(point => point.index >= firstTrackedIndex)
            .map(point => ({ ...point, value: point.value === null ? 0 : point.value }))
        : valid.map(point => ({ ...point, value: 0 }));

    if (!days.length) {
        chart.innerHTML = '<div class="chart-empty"><strong>Activity data unavailable</strong><span>The server did not return a date range. Refresh the dashboard or check the API response.</span></div>';
        ["activityPeak", "activityAverage", "activityTotal"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = "0";
        });
        if (note) note.textContent = "No activity dates were returned.";
        return;
    }

    const maxValue = Math.max(1, ...plotPoints.map(point => point.value));
    const axisMax = Math.max(100, Math.ceil(maxValue / 100) * 100);
    const left = 34, right = 332, top = 12, bottom = 150;
    const xFor = index => left + (days.length <= 1 ? 0 : (index / (days.length - 1)) * (right - left));
    const yFor = value => bottom - (value / axisMax) * (bottom - top);
    const points = plotPoints.map(point => ({ ...point, x: xFor(point.index), y: yFor(point.value) }));
    const linePath = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${bottom} L${points[0].x.toFixed(1)},${bottom} Z`;
    const ticks = [0, .25, .5, .75, 1].map(fraction => Math.round(axisMax * fraction));
    const grid = ticks.map(value => {
        const y = yFor(value);
        return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="chart-grid-line"/><text x="27" y="${y + 4}" text-anchor="end" class="chart-axis-label">${numberFormat.format(value)}</text>`;
    }).join("");
    const labelIndexes = new Set();
    const labelCount = Math.min(7, days.length);
    for (let i = 0; i < labelCount; i++) labelIndexes.add(Math.round(i * (days.length - 1) / Math.max(1, labelCount - 1)));
    const xLabels = [...labelIndexes].map(index => `<text x="${xFor(index)}" y="174" text-anchor="middle" class="chart-date-label">${formatDayLabel(days[index].dayKey)}</text>`).join("");
    const circles = points.map(point => `<circle cx="${point.x}" cy="${point.y}" r="${hasData ? 4.1 : 3.2}" class="chart-point"><title>${escapeHTML(formatDayLabel(point.dayKey))}: ${numberFormat.format(point.value)} requests${point.value === 0 && !hasData ? " (waiting for first request)" : ""}</title></circle>`).join("");
    chart.innerHTML = `
        <svg class="activity-chart-svg${hasData ? "" : " chart-awaiting-data"}" viewBox="0 0 350 190" preserveAspectRatio="none" role="img" aria-label="${hasData ? "Daily key verification requests over the selected period" : "No key verification requests recorded yet; chart is at zero"}">
            <defs><linearGradient id="activityAreaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#48A986" stop-opacity=".34"/><stop offset="100%" stop-color="#48A986" stop-opacity=".035"/></linearGradient></defs>
            ${grid}
            <path d="${areaPath}" class="chart-area-path"/>
            <path d="${linePath}" class="chart-line-path"/>
            ${circles}${xLabels}
        </svg>`;

    const total = tracked.reduce((sum, point) => sum + point.value, 0);
    const peak = tracked.length
        ? tracked.reduce((best, point) => point.value > best.value ? point : best, tracked[0])
        : null;
    const average = tracked.length ? Math.round(total / tracked.length) : 0;

    const peakEl = document.getElementById("activityPeak");
    const peakLabelEl = document.getElementById("activityPeakLabel");
    const averageEl = document.getElementById("activityAverage");
    const totalEl = document.getElementById("activityTotal");
    if (peakEl) peakEl.textContent = numberFormat.format(peak ? peak.value : 0);
    if (peakLabelEl) peakLabelEl.textContent = peak ? `Highest (${formatDayLabel(peak.dayKey)})` : "Highest day";
    if (averageEl) averageEl.textContent = numberFormat.format(average);
    if (totalEl) totalEl.textContent = numberFormat.format(total);

    if (note) {
        if (!hasData) {
            note.textContent = "No verification requests recorded yet. The chart will update automatically when the first request reaches the server; older history is not backfilled.";
        } else if (data.trackingStartedAt) {
            note.textContent = `Tracking since ${formatDayLabel(data.trackingStartedAt)}. Counts include successful and failed verification requests. Earlier history is not available.`;
        } else {
            note.textContent = "Counts include successful and failed key verification requests received by the server.";
        }
    }
}

async function loadUserActivity(range = 7) {
    const chart = document.getElementById("userActivityChart");
    if (!chart) return;
    chart.innerHTML = '<div class="chart-loading"><span class="chart-spinner"></span>Loading request activity</div>';
    try {
        const endpoint = __dashRole === "customer"
            ? "/customer/dashboard/user-activity"
            : "/dashboard/user-activity";
        const response = await apiFetch(`${endpoint}?range=${encodeURIComponent(range)}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.message || "Unable to load activity");
        renderUserActivity(data);
    } catch (err) {
        console.error("User activity chart error:", err);
        chart.innerHTML = '<div class="chart-empty"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><strong>Activity unavailable</strong><span>Could not load verification request totals. Please refresh the dashboard.</span></div>';
    }
}

loadUserActivity(7);
document.getElementById("activityRange")?.addEventListener("change", event => loadUserActivity(event.target.value));
// Event-driven refresh: the server emits only after a verification request
// has been counted, and only to the owning Admin or Customer dashboard room.
if (typeof window.io === "function" && !window.__dashboardActivitySocket) {
    const dashboardToken = __dashRole === "customer"
        ? localStorage.getItem("customerToken")
        : localStorage.getItem("token");
    if (dashboardToken) {
        const activitySocket = window.io({
            auth: { token: dashboardToken },
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000
        });
        activitySocket.on("connect", () => {
            // Catch up after initial connection or reconnect so events missed
            // while the dashboard was offline do not leave the graph stale.
            const selectedRange = document.getElementById("activityRange")?.value || 7;
            loadUserActivity(selectedRange);
        });
        activitySocket.on("verification:request", () => {
            const selectedRange = document.getElementById("activityRange")?.value || 7;
            loadUserActivity(selectedRange);
        });
        activitySocket.on("connect_error", error => {
            console.warn("Dashboard live activity connection unavailable:", error.message);
        });
        window.__dashboardActivitySocket = activitySocket;
    }
}

async function loadCustomerGameId() {
    if (__dashRole !== "customer") return;
    try {
        const response = await apiFetch("/customer/me");
        const data = await response.json();
        if (!data.success || !data.customer?.gameId) return;
        const chip = document.getElementById("customerGameIdChip");
        const value = document.getElementById("customerGameId");
        if (chip && value) {
            value.textContent = data.customer.gameId;
            chip.style.display = "inline-flex";
            document.getElementById("copyCustomerGameId")?.addEventListener("click", async () => {
                try {
                    await navigator.clipboard.writeText(data.customer.gameId);
                    showToast("Copied", "Customer Game ID copied to clipboard.", "success");
                } catch (_) {
                    const area = document.createElement("textarea");
                    area.value = data.customer.gameId;
                    area.setAttribute("readonly", "");
                    area.style.position = "fixed";
                    area.style.opacity = "0";
                    document.body.appendChild(area);
                    area.select();
                    document.execCommand("copy");
                    area.remove();
                    showToast("Copied", "Customer Game ID copied to clipboard.", "success");
                }
            });
        }
    } catch (err) {
        console.error("Customer Game ID load error:", err);
    }
}

loadCustomerGameId();
