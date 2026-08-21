(function () {

    if ((typeof getPanelRole === "function" ? getPanelRole() : null) === "customer") {

        if (typeof showToast === "function") {
            showToast("Restricted", "Sorry, it's allowed only to the admin.", "error");
        }

        setTimeout(() => window.location.replace("/panel"), 900);

        return;

    }

    function fmtDate(d) {
        return new Date(d).toLocaleString();
    }

    function referralItemHtml(r) {

        const expired = new Date(r.expiryAt) <= new Date();

        const statusLabel = r.status === "used"
            ? "used"
            : (r.status === "revoked" ? "revoked" : (expired ? "expired" : "active"));

        return `
            <div class="cust-item" data-id="${r._id}">
                <div>
                    <div class="cust-item-key">${r.code}</div>
                    <div class="cust-item-meta">
                        Expiry ${fmtDate(r.expiryAt)}
                        ${r.usedBy ? `&bull; used by <strong>${r.usedBy.username}</strong>` : ""}
                        <span class="cust-badge ${statusLabel === 'active' ? 'active' : (statusLabel === 'used' ? 'expired' : 'banned')}">${statusLabel}</span>
                    </div>
                </div>
                <div class="cust-item-actions">
                    <button data-action="copy">Copy</button>
                    ${r.status === "active"
                        ? `<button data-action="revoke" class="danger">Revoke</button>
                           <button data-action="delete" class="danger">Delete</button>`
                        : ""}
                </div>
            </div>
        `;

    }

    async function loadReferrals() {

        const res = await apiFetch("/referral");
        const data = await res.json();

        const list = document.getElementById("referralsList");

        if (!data.success || !data.referrals.length) {

            list.innerHTML = `<p class="cust-empty">No referral codes yet.</p>`;

            return;

        }

        list.innerHTML = data.referrals.map(referralItemHtml).join("");

    }

    document.getElementById("createReferralBtn").addEventListener("click", async () => {

        const expiryDays = document.getElementById("refExpiryDays").value;

        const res = await apiFetch("/referral", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expiryDays })
        });

        const data = await res.json();

        if (!data.success) {

            showToast("Error", data.message || "Could not create code.", "error");

            return;

        }

        showToast("Referral Created", data.referral.code, "success");

        loadReferrals();

    });

    document.getElementById("referralsList").addEventListener("click", async (e) => {

        const btn = e.target.closest("button[data-action]");

        if (!btn) return;

        const id = btn.closest("[data-id]").dataset.id;
        const action = btn.dataset.action;

        if (action === "copy") {

            const code = btn.closest(".cust-item").querySelector(".cust-item-key").textContent;

            navigator.clipboard?.writeText(code);

            showToast("Copied", code, "success");

            return;

        }

        if (action === "revoke") {

            if (!confirm("Revoke this referral code?")) return;

            const res = await apiFetch(`/referral/${id}/revoke`, { method: "PUT" });
            const data = await res.json();

            if (!data.success) {
                showToast("Error", data.message, "error");
                return;
            }

        }

        if (action === "delete") {

            if (!confirm("Delete this referral code?")) return;

            const res = await apiFetch(`/referral/${id}`, { method: "DELETE" });
            const data = await res.json();

            if (!data.success) {
                showToast("Error", data.message, "error");
                return;
            }

        }

        loadReferrals();

    });

    // ===== Customers =====

    function customerItemHtml(c) {

        const expired = new Date(c.expiryAt) <= new Date();
        const statusLabel = c.status === "disabled" ? "disabled" : (expired ? "expired" : "active");

        return `
            <div class="cust-item" data-id="${c._id}">
                <div>
                    <div class="cust-item-key">${c.username}</div>
                    <div class="cust-item-meta">
                        Access until ${fmtDate(c.expiryAt)}
                        <span class="cust-badge ${statusLabel === 'active' ? 'active' : 'banned'}">${statusLabel}</span>
                    </div>
                </div>
                <div class="cust-item-actions">
                    <button data-action="extend">+30d</button>
                    ${c.status === "disabled"
                        ? `<button data-action="enable">Enable</button>`
                        : `<button data-action="disable" class="danger">Disable</button>`}
                    <button data-action="delete" class="danger">Delete</button>
                </div>
            </div>
        `;

    }

    async function loadCustomers() {

        const res = await apiFetch("/customers");
        const data = await res.json();

        const list = document.getElementById("customersList");

        if (!data.success || !data.customers.length) {

            list.innerHTML = `<p class="cust-empty">No customers yet.</p>`;

            return;

        }

        list.innerHTML = data.customers.map(customerItemHtml).join("");

    }

    document.getElementById("customersList").addEventListener("click", async (e) => {

        const btn = e.target.closest("button[data-action]");

        if (!btn) return;

        const id = btn.closest("[data-id]").dataset.id;
        const action = btn.dataset.action;

        let res;

        if (action === "extend") {

            res = await apiFetch(`/customers/${id}/extend`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ expiryDays: 30 })
            });

        } else if (action === "disable" || action === "enable") {

            res = await apiFetch(`/customers/${id}/status`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: action === "disable" ? "disabled" : "active" })
            });

        } else if (action === "delete") {

            if (!confirm("Permanently delete this customer? Their data is removed.")) return;

            res = await apiFetch(`/customers/${id}`, { method: "DELETE" });

        }

        const data = await res.json();

        if (!data.success) {
            showToast("Error", data.message || "Action failed.", "error");
            return;
        }

        showToast("Done", "Updated successfully.", "success");

        loadCustomers();

    });

    loadReferrals();
    loadCustomers();

})();
