if (!localStorage.getItem("token") && !localStorage.getItem("customerToken")) {

    window.location.replace("/login");

}

if (typeof initSidebar === "function") {
    initSidebar();
}
initAutoLogout();

const __role = (typeof getPanelRole === "function") ? getPanelRole() : (localStorage.getItem("token") ? "admin" : "customer");

if (__role === "customer") {

    initLicenseManager("/customer/premium/list");

    window.LICENSE_DETAILS_ENDPOINT = "/customer/dashboard/license";
    window.CREATE_LICENSE_ENDPOINT = "/customer/premium/create";
    window.DELETE_LICENSE_ENDPOINT = "/customer/premium/delete";
    window.BAN_LICENSE_ENDPOINT = "/customer/dashboard/ban";
    window.UNBAN_LICENSE_ENDPOINT = "/customer/dashboard/unban";
    window.EXTEND_LICENSE_ENDPOINT = "/customer/dashboard/extend";
    window.RESET_DEVICE_ENDPOINT = "/customer/dashboard/reset-device";

} else {

    initLicenseManager("/premium/list");

    window.LICENSE_DETAILS_ENDPOINT = "/premium/license";
    window.CREATE_LICENSE_ENDPOINT = "/premium/create";
    window.DELETE_LICENSE_ENDPOINT = "/premium/delete";
    window.BAN_LICENSE_ENDPOINT = "/premium/ban";
    window.UNBAN_LICENSE_ENDPOINT = "/premium/unban";
    window.EXTEND_LICENSE_ENDPOINT = "/premium/extend";
    window.RESET_DEVICE_ENDPOINT = "/premium/reset-device";

}


// Premium Keys UI: list/search/details are kept in one page so
// navigation stays instant while the existing API endpoints remain unchanged.
(function initPublicKeysExperience() {
    const search = document.getElementById("licenseSearch");
    const details = document.getElementById("pkDetailsView");
    const list = document.getElementById("pkListView");
    const back = document.getElementById("backToKeys");
    let selectedKey = null;

    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));

    const prettyDate = (value) => value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";
    const prettyDateTime = (value) => value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Never used";

    function updateStats() {
        const count = (status) => allLicenses.filter(x => x.status === status).length;
        const totalDevices = allLicenses.reduce((sum, x) => sum + Number(x.usedCount || 0), 0);
        document.getElementById("statTotal").textContent = allLicenses.length;
        document.getElementById("statActive").textContent = count("active");
        document.getElementById("statDevices").textContent = totalDevices.toLocaleString();
        document.getElementById("filterAllCount").textContent = allLicenses.length;
        document.getElementById("filterActiveCount").textContent = count("active");
        document.getElementById("filterBannedCount").textContent = count("banned");
        document.getElementById("filterExpiredCount").textContent = count("expired");
    }

    function filterAndSearch() {
        const term = (search?.value || "").trim().toLowerCase();
        const filtered = allLicenses.filter(license => {
            const statusMatch = currentFilter === "all" || license.status === currentFilter;
            const text = `${license.key} ${license.status} ${license.lastDevice || ""}`.toLowerCase();
            return statusMatch && (!term || text.includes(term));
        });
        renderLicenses(filtered);
        const empty = document.getElementById("licenseEmpty");
        empty.hidden = filtered.length !== 0;
    }

    const originalApplyFilters = window.applyFilters;
    // license-manager.js owns the filter buttons; override its render pass with
    // search-aware filtering while keeping the same global state.
    window.applyFilters = filterAndSearch;

    const originalLoad = window.loadLicenses;
    if (originalLoad) {
        // no-op: the manager calls applyFilters after loading.
    }

    const originalRender = window.renderLicenses;
    window.renderLicenses = function(licenses) {
        originalRender(licenses);
        updateStats();
        decorateLicenseCards();
    };

    function decorateLicenseCards() {
        document.querySelectorAll("#mobileLicenseList .license-card").forEach(card => {
            const key = card.querySelector("h3")?.textContent || "";
            const license = allLicenses.find(x => x.key === key);
            if (!license) return;
            card.innerHTML = `
                <div class="pk-card-head">
                    <div class="pk-card-key"><span class="pk-key-icon"><i class="fa-solid fa-crown"></i></span><h3 title="${esc(license.key)}">${esc(license.key)}</h3></div>
                    <span class="pk-status ${esc(license.status)}"><i class="fa-solid fa-circle"></i>${esc(license.status)}</span>
                </div>
                <div class="pk-card-meta">
                    <div><small>EXPIRY</small><strong>${esc(prettyDate(license.expiry))}</strong></div>
                    <div><small>DEVICES</small><strong>${Number(license.usedCount || 0)} / ${Number(license.maxUses || 0)}</strong></div>
                </div>
                <div class="pk-last-used"><span><i class="fa-regular fa-clock"></i> Last used</span><strong>${esc(prettyDateTime(license.lastUsed))}</strong></div>
                <div class="pk-card-progress"><span style="width:${Math.min(100, Number(license.maxUses) ? (Number(license.usedCount || 0) / Number(license.maxUses)) * 100 : 0)}%"></span></div>
                <div class="card-actions">
                    <button class="action-btn view-btn" data-key="${esc(license.key)}"><i class="fa-solid fa-eye"></i> View</button>
                    <button class="action-btn copy-btn" data-key="${esc(license.key)}"><i class="fa-regular fa-copy"></i> Copy</button>
                </div>`;
        });

        document.querySelectorAll("#licenseTable tr").forEach(row => {
            const key = row.children[0]?.textContent?.trim();
            const license = allLicenses.find(x => x.key === key);
            if (!license) return;
            row.children[0].innerHTML = `<span class="pk-table-key"><i class="fa-solid fa-key"></i>${esc(license.key)}</span>`;
            row.children[1].innerHTML = `<span class="pk-status ${esc(license.status)}"><i class="fa-solid fa-circle"></i>${esc(license.status)}</span>`;
            row.children[2].textContent = prettyDate(license.expiry);
            row.children[3].innerHTML = `<span class="pk-device-value">${Number(license.usedCount || 0)} / ${Number(license.maxUses || 0)}</span>`;
        });
    }

    async function showDetails(key, push = true) {
        try {
            const endpoint = window.LICENSE_DETAILS_ENDPOINT || "/dashboard/license";
            const response = await apiFetch(`${endpoint}/${encodeURIComponent(key)}`);
            const data = await response.json();
            if (!data.success) {
                showToast("Error", data.message || "License not found", "error");
                return;
            }
            selectedKey = data.license.key;
            const l = data.license;
            const days = l.expiry ? Math.ceil((new Date(l.expiry) - new Date()) / 86400000) : 0;
            const used = Number(l.usedCount || 0);
            const max = Number(l.maxUses || 0);
            const percent = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;

            document.getElementById("detailKeyName").textContent = l.key;
            const safeStatus = ["active", "banned", "expired"].includes(l.status) ? l.status : "unknown";
            const status = document.getElementById("detailStatus");
            status.className = `pk-status ${safeStatus}`;
            status.innerHTML = `<i class="fa-solid fa-circle"></i> ${esc(safeStatus)}`;
            document.getElementById("detailInfoStatus").textContent = safeStatus;
            document.getElementById("detailCreated").textContent = prettyDateTime(l.createdAt);
            document.getElementById("detailExpiry").textContent = prettyDate(l.expiry);
            document.getElementById("detailDaysLeft").textContent = days > 0 ? `${days} days` : "Expired";
            document.getElementById("detailDaysLeft").className = days > 0 && days <= 7 ? "warning" : days > 0 ? "good" : "danger";
            document.getElementById("detailLastUsed").textContent = prettyDateTime(l.lastUsed);
            document.getElementById("detailDevices").textContent = `${used} / ${max}`;
            document.getElementById("usageUsed").textContent = used.toLocaleString();
            document.getElementById("usageAllowed").textContent = max.toLocaleString();
            document.getElementById("detailProgress").style.width = `${percent}%`;
            document.getElementById("detailProgressText").textContent = `${percent}%`;
            document.getElementById("deviceCountBadge").textContent = String((l.devices || []).length);

            const deviceList = document.getElementById("registeredDevices");
            const devices = Array.isArray(l.devices) ? l.devices : [];
            deviceList.innerHTML = devices.length ? devices.map((device, i) => {
                const d = typeof device === "string" ? { name: device } : (device || {});
                const meta = [d.brand, d.model, d.androidVersion ? `Android ${d.androidVersion}` : ""].filter(Boolean).join(" • ");
                return `<div class="pk-device-row"><span class="pk-device-avatar"><i class="fa-solid fa-mobile-screen-button"></i></span><div><strong title="${esc(d.name || `Registered Device ${i + 1}`)}">${esc(d.name || `Registered Device ${i + 1}`)}</strong><small>${esc(meta || "Registered device")}</small></div><i class="fa-solid fa-circle-check"></i></div>`;
            }).join("") : `<div class="pk-no-devices"><i class="fa-solid fa-mobile-screen-button"></i><span>No registered devices yet.</span></div>`;

            const ban = document.getElementById("detailBanBtn");
            ban.querySelector("span")?.remove();
            ban.innerHTML = `<i class="fa-solid fa-${safeStatus === "banned" ? "circle-check" : "ban"}"></i><span>${safeStatus === "banned" ? "Unban" : "Ban"}</span>`;
            ban.classList.toggle("is-banned", safeStatus === "banned");
            details.hidden = false;
            list.hidden = true;
            document.body.classList.add("pk-details-open");
            if (push) history.pushState({ publicKey: l.key }, "", `/premium-keys?key=${encodeURIComponent(l.key)}`);
            window.scrollTo({ top: 0, behavior: "instant" });
        } catch (err) {
            console.error(err);
            showToast("Error", "Could not load license details", "error");
        }
    }

    window.openKeyDetails = showDetails;

    function closeDetails(push = true) {
        details.hidden = true;
        list.hidden = false;
        selectedKey = null;
        document.body.classList.remove("pk-details-open");
        if (push) history.pushState({}, "", "/premium-keys");
        window.scrollTo({ top: 0, behavior: "instant" });
    }

    document.addEventListener("click", (e) => {
        const view = e.target.closest(".view-btn");
        if (view) { e.preventDefault(); showDetails(view.dataset.key); }
    });

    back?.addEventListener("click", () => closeDetails());
    window.addEventListener("popstate", () => {
        const key = new URLSearchParams(location.search).get("key");
        if (key) showDetails(key, false); else closeDetails(false);
    });

    search?.addEventListener("input", filterAndSearch);
    document.addEventListener("keydown", (e) => {
        if (e.key === "/" && document.activeElement !== search && !details.hidden) return;
        if (e.key === "/" && document.activeElement !== search) { e.preventDefault(); search?.focus(); }
        if (e.key === "Escape" && !details.hidden) closeDetails();
    });

    document.getElementById("detailCopyBtn")?.addEventListener("click", (e) => {
        if (selectedKey) copyText(selectedKey, e.currentTarget);
    });
    document.getElementById("detailViewKeyBtn")?.addEventListener("click", (e) => {
        if (!selectedKey) return;
        const name = document.getElementById("detailKeyName");
        const hidden = name.dataset.revealed !== "true";
        name.textContent = hidden ? selectedKey : `${selectedKey.slice(0, 4)}••••••••${selectedKey.slice(-4)}`;
        name.dataset.revealed = hidden ? "true" : "false";
        e.currentTarget.innerHTML = hidden ? '<i class="fa-solid fa-eye-slash"></i> Hide Key' : '<i class="fa-solid fa-eye"></i> View Key';
    });
    document.getElementById("detailBanBtn")?.addEventListener("click", () => {
        if (!selectedKey) return;
        currentLicenseKey = selectedKey;
        banLicense();
    });
    document.getElementById("detailExtendBtn")?.addEventListener("click", () => {
        if (!selectedKey) return;
        currentLicenseKey = selectedKey;
        setExtendMode("license");
        extendModal.classList.add("active");
    });
    document.getElementById("detailResetBtn")?.addEventListener("click", () => {
        if (!selectedKey) return;
        currentLicenseKey = selectedKey;
        resetDevice();
    });
    document.getElementById("detailDeleteBtn")?.addEventListener("click", () => {
        if (!selectedKey) return;
        currentLicenseKey = selectedKey;
        document.getElementById("deleteLicenseKey").textContent = selectedKey;
        deleteModal.classList.add("active");
    });

    const originalLoadLicenses = window.loadLicenses;
    // Initial query-string deep link after the first list fetch.
    const observer = new MutationObserver(() => {
        const key = new URLSearchParams(location.search).get("key");
        if (key && allLicenses.length && details.hidden) showDetails(key, false);
    });
    observer.observe(document.getElementById("mobileLicenseList"), { childList: true });
})();
