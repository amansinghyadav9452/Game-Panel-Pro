(function () {

    if ((typeof getPanelRole === "function" ? getPanelRole() : null) === "customer") {
        if (typeof showToast === "function") {
            showToast("Restricted", "Referral management is admin-only.", "error");
        }
        setTimeout(() => window.location.replace("/panel"), 900);
        return;
    }

    const referralsList = document.getElementById("referralsList");
    const customersList = document.getElementById("customersList");

    function fmtDate(d) {
        return new Date(d).toLocaleString();
    }

    function statusFor(r) {
        if (r.status === "used") return "used";
        if (r.status === "revoked") return "revoked";
        return new Date(r.expiryAt) <= new Date() ? "expired" : "active";
    }

    function referralItemHtml(r) {
        const status = statusFor(r);
        const used = status === "used";

        return `
            <div class="referral-swipe-item" data-id="${r._id}" data-used="${used}">
                <button class="referral-delete-reveal" data-action="delete" aria-label="Delete referral ${r.code}">
                    <i class="fa-solid fa-trash"></i>
                </button>
                <div class="referral-swipe-content">
                    <div>
                        <div class="referral-code">${r.code}</div>
                        <div class="referral-meta">
                            <span>EXP ${fmtDate(r.expiryAt)}</span>
                            ${r.usedBy ? `<span>USED BY ${r.usedBy.username}</span>` : ""}
                            <span class="referral-status ${status}">${status}</span>
                        </div>
                    </div>
                    <div class="referral-actions">
                        <button data-action="copy">Copy</button>
                        ${r.status === "active" ? `<button data-action="revoke" class="danger">Revoke</button>` : ""}
                        ${!used ? `<button data-action="delete" class="danger desktop-only">Delete</button>` : ""}
                    </div>
                </div>
            </div>
        `;
    }

    function showListLoading(list, count = 4) {
        if (!list) return;
        list.innerHTML = Array.from({ length: count }, () => `<div class="gp-loading-card" style="min-height:78px;"></div>`).join("");
    }

    async function loadReferrals() {
        showListLoading(referralsList, 4);
        try {
            const res = await apiFetch("/referral");
            const data = await res.json();
            if (!data.success || !data.referrals.length) {
                referralsList.innerHTML = `<p class="cust-empty">No referral codes yet.</p>`;
                return;
            }
            referralsList.innerHTML = data.referrals.map(referralItemHtml).join("");
        } catch (err) {
            console.error(err);
            referralsList.innerHTML = `<p class="cust-empty">Failed to load referral codes.</p>`;
        }
    }

    async function createReferral() {
        const expiryDays = Number(document.getElementById("refExpiryDays").value);
        const btn = document.getElementById("createReferralBtn");
        if (!Number.isFinite(expiryDays) || expiryDays < 1 || expiryDays > 3650) {
            showToast("Error", "Validity must be between 1 and 3650 days.", "error");
            return;
        }
        btn.disabled = true;
        try {
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
        } catch (err) {
            console.error(err);
            showToast("Error", "Server connection failed.", "error");
        } finally {
            btn.disabled = false;
        }
    }

    document.getElementById("createReferralBtn")?.addEventListener("click", createReferral);

    // ---- Swipe-to-delete for referral cards ----
    let swipe = null;

    referralsList?.addEventListener("pointerdown", (e) => {
        const content = e.target.closest(".referral-swipe-content");
        if (!content || e.target.closest("button")) return;
        const item = content.closest(".referral-swipe-item");
        if (!item) return;
        swipe = { item, startX: e.clientX, startY: e.clientY, moved: false };
        content.setPointerCapture?.(e.pointerId);
    });

    referralsList?.addEventListener("pointermove", (e) => {
        if (!swipe) return;
        const dx = e.clientX - swipe.startX;
        const dy = e.clientY - swipe.startY;
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
            swipe = null;
            return;
        }
        if (dx < -12) swipe.moved = true;
        const content = swipe.item.querySelector(".referral-swipe-content");
        if (content && dx < 0) {
            const amount = Math.min(86, Math.abs(dx));
            content.style.transition = "none";
            content.style.transform = `translateX(-${amount}px)`;
        }
    });

    referralsList?.addEventListener("pointerup", (e) => {
        if (!swipe) return;
        const { item, startX } = swipe;
        const content = item.querySelector(".referral-swipe-content");
        const dx = e.clientX - startX;
        if (content) {
            content.style.transition = "";
            content.style.transform = "";
        }
        if (dx < -45) {
            item.classList.add("swiped");
        } else if (dx > 25) {
            item.classList.remove("swiped");
        }
        swipe = null;
    });

    referralsList?.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        const item = btn.closest(".referral-swipe-item");
        const id = item?.dataset.id;
        const action = btn.dataset.action;
        if (!id) return;

        if (action === "copy") {
            const code = item.querySelector(".referral-code")?.textContent || "";
            try { await navigator.clipboard.writeText(code); } catch (_) {}
            showToast("Copied", code, "success");
            return;
        }

        if (action === "revoke") {
            if (!confirm("Revoke this referral code?")) return;
            const res = await apiFetch(`/referral/${id}/revoke`, { method: "PUT" });
            const data = await res.json();
            if (!data.success) {
                showToast("Error", data.message || "Could not revoke code.", "error");
                return;
            }
            loadReferrals();
            return;
        }

        if (action === "delete") {
            if (!confirm("Delete this referral record? The customer account, if already created, will not be deleted.")) return;
            const res = await apiFetch(`/referral/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) {
                showToast("Error", data.message || "Could not delete code.", "error");
                return;
            }
            showToast("Deleted", "Referral record removed.", "success");
            loadReferrals();
        }
    });

    function customerItemHtml(c) {
        const expired = new Date(c.expiryAt) <= new Date();
        const status = c.status === "disabled" ? "disabled" : (expired ? "expired" : "active");
        return `
            <div class="customer-management-item" data-id="${c._id}">
                <div>
                    <div class="customer-name">${c.username}</div>
                    <div class="customer-meta">ACCESS UNTIL ${fmtDate(c.expiryAt)} • <span class="referral-status ${status === "active" ? "active" : "expired"}">${status}</span></div>
                </div>
                <div class="customer-actions">
                    <button data-action="extend">+30d</button>
                    ${c.status === "disabled" ? `<button data-action="enable">Enable</button>` : `<button data-action="disable" class="danger">Disable</button>`}
                    <button data-action="delete" class="danger">Delete</button>
                </div>
            </div>
        `;
    }

    async function loadCustomers() {
        showListLoading(customersList, 3);
        try {
            const res = await apiFetch("/customers");
            const data = await res.json();
            if (!data.success || !data.customers.length) {
                customersList.innerHTML = `<p class="cust-empty">No customers yet.</p>`;
                return;
            }
            customersList.innerHTML = data.customers.map(customerItemHtml).join("");
        } catch (err) {
            console.error(err);
            customersList.innerHTML = `<p class="cust-empty">Failed to load customers.</p>`;
        }
    }

    customersList?.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        const id = btn.closest("[data-id]")?.dataset.id;
        const action = btn.dataset.action;
        if (!id) return;

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
            if (!confirm("Permanently delete this customer? Their keys and customer data will be removed.")) return;
            res = await apiFetch(`/customers/${id}`, { method: "DELETE" });
        }

        if (!res) return;
        const data = await res.json();
        if (!data.success) {
            showToast("Error", data.message || "Action failed.", "error");
            return;
        }
        showToast("Updated", "Customer record updated.", "success");
        loadCustomers();
    });

    loadReferrals();
    loadCustomers();

})();
