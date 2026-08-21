(function () {

    const token = localStorage.getItem("customerToken");

    if (!token) {
        window.location.replace("/login");
        return;
    }

    const api = async (path, opts = {}) => {

        const res = await fetch(path, {
            ...opts,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...(opts.headers || {})
            }
        });

        const data = await res.json().catch(() => ({ success: false, message: "Server error." }));

        if (res.status === 401 || (res.status === 403 && /expired|disabled/i.test(data.message || ""))) {

            localStorage.removeItem("customerToken");

            alert(data.message || "Session ended.");

            window.location.replace("/login");

            throw new Error("unauthorized");

        }

        return data;

    };

    function toast(title, msg, type) {
        if (typeof showToast === "function") showToast(title, msg, type);
    }

    function fmtDate(d) {
        return new Date(d).toLocaleString();
    }

    // ===== Nav =====

    const navButtons = document.querySelectorAll(".cust-nav-btn");
    const views = {
        keys: document.getElementById("viewKeys"),
        crudlogs: document.getElementById("viewCrudlogs"),
        activitylogs: document.getElementById("viewActivitylogs")
    };

    navButtons.forEach((btn) => {

        btn.addEventListener("click", () => {

            navButtons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");

            Object.entries(views).forEach(([key, el]) => {
                el.style.display = key === btn.dataset.view ? "block" : "none";
            });

            if (btn.dataset.view === "keys") loadKeys();
            if (btn.dataset.view === "crudlogs") loadCrudLogs();
            if (btn.dataset.view === "activitylogs") loadActivityLogs();

        });

    });

    // ===== Profile / header =====

    async function loadMe() {

        const data = await api("/customer/me");

        if (!data.success) return;

        document.getElementById("custWelcome").textContent =
            `Welcome, ${data.customer.username}`;

        const badge = document.getElementById("custExpiryBadge");

        const expiry = new Date(data.customer.expiryAt);
        const daysLeft = Math.ceil((expiry - Date.now()) / 86400000);

        badge.textContent = `Access valid till ${expiry.toLocaleDateString()}`;

        if (daysLeft <= 3) badge.classList.add("warn");

    }

    document.getElementById("custLogoutBtn").addEventListener("click", () => {
        localStorage.removeItem("customerToken");
        window.location.replace("/login");
    });

    // ===== Keys =====

    document.getElementById("openCreateKeyBtn").addEventListener("click", () => {

        const form = document.getElementById("createKeyForm");

        form.style.display = form.style.display === "none" ? "block" : "none";

    });

    document.getElementById("submitCreateKeyBtn").addEventListener("click", async () => {

        const type = document.getElementById("newKeyType").value;
        const expiryDays = document.getElementById("newKeyExpiryDays").value;
        const maxUses = document.getElementById("newKeyMaxUses").value;

        const data = await api("/customer/keys", {
            method: "POST",
            body: JSON.stringify({ type, expiryDays, maxUses })
        });

        if (!data.success) {
            toast("Error", data.message || "Could not create key.", "error");
            return;
        }

        toast("Key Created", data.key.key, "success");

        document.getElementById("createKeyForm").style.display = "none";

        loadKeys();

    });

    document.getElementById("keyTypeFilter").addEventListener("change", loadKeys);

    function keyItemHtml(k) {

        return `
            <div class="cust-item" data-key="${k.key}">
                <div>
                    <div class="cust-item-key">${k.key}</div>
                    <div class="cust-item-meta">
                        ${k.type.toUpperCase()} &bull;
                        Expires ${fmtDate(k.expiry)} &bull;
                        ${k.usedCount || 0}/${k.maxUses} devices
                        <span class="cust-badge ${k.status}">${k.status}</span>
                    </div>
                </div>
                <div class="cust-item-actions">
                    ${k.status === "banned"
                        ? `<button data-action="unban">Unban</button>`
                        : `<button data-action="ban">Ban</button>`}
                    <button data-action="extend">+30d</button>
                    <button data-action="reset-device">Reset Device</button>
                    <button data-action="delete" class="danger">Delete</button>
                </div>
            </div>
        `;

    }

    async function loadKeys() {

        const type = document.getElementById("keyTypeFilter").value;

        const data = await api(`/customer/keys${type ? `?type=${type}` : ""}`);

        const list = document.getElementById("keysList");

        if (!data.success || !data.keys.length) {

            list.innerHTML = `<p class="cust-empty">No keys yet. Create one above.</p>`;

            return;

        }

        list.innerHTML = data.keys.map(keyItemHtml).join("");

    }

    document.getElementById("keysList").addEventListener("click", async (e) => {

        const btn = e.target.closest("button[data-action]");

        if (!btn) return;

        const key = btn.closest("[data-key]").dataset.key;
        const action = btn.dataset.action;

        let data;

        if (action === "ban") {

            data = await api(`/customer/keys/${key}/ban`, { method: "PUT", body: JSON.stringify({}) });

        } else if (action === "unban") {

            data = await api(`/customer/keys/${key}/unban`, { method: "PUT", body: JSON.stringify({}) });

        } else if (action === "extend") {

            data = await api(`/customer/keys/${key}/extend`, { method: "PUT", body: JSON.stringify({ expiryDays: 30 }) });

        } else if (action === "reset-device") {

            data = await api(`/customer/keys/${key}/reset-device`, { method: "PUT", body: JSON.stringify({}) });

        } else if (action === "delete") {

            if (!confirm(`Delete key ${key}? This cannot be undone.`)) return;

            data = await api(`/customer/keys/${key}`, { method: "DELETE" });

        }

        if (!data?.success) {
            toast("Error", data?.message || "Action failed.", "error");
            return;
        }

        toast("Done", `${action} successful.`, "success");

        loadKeys();

    });

    // ===== Logs =====

    async function loadCrudLogs() {

        const data = await api("/customer/logs/crud");

        const list = document.getElementById("crudLogsList");

        if (!data.success || !data.logs.length) {

            list.innerHTML = `<p class="cust-empty">No key activity yet.</p>`;

            return;

        }

        list.innerHTML = data.logs.map((l) => `
            <div class="cust-item">
                <div>
                    <div class="cust-log-line">
                        <strong>${l.action}</strong> — ${l.key} ${l.type ? `(${l.type})` : ""}
                        ${l.details ? `— ${l.details}` : ""}
                    </div>
                    <div class="cust-log-time">${fmtDate(l.createdAt)}</div>
                </div>
            </div>
        `).join("");

    }

    async function loadActivityLogs() {

        const data = await api("/customer/logs/activity");

        const list = document.getElementById("activityLogsList");

        if (!data.success || !data.logs.length) {

            list.innerHTML = `<p class="cust-empty">No verification activity yet.</p>`;

            return;

        }

        list.innerHTML = data.logs.map((l) => `
            <div class="cust-item">
                <div>
                    <div class="cust-log-line">
                        <span class="cust-badge ${l.status === "success" ? "active" : "banned"}">${l.status}</span>
                        ${l.licenseKey} ${l.reason ? `— ${l.reason}` : ""}
                    </div>
                    <div class="cust-log-time">
                        ${l.deviceModel || ""} ${l.serial ? `&bull; ${l.serial}` : ""} &bull; ${fmtDate(l.createdAt)}
                    </div>
                </div>
            </div>
        `).join("");

    }

    loadMe();
    loadKeys();

})();
