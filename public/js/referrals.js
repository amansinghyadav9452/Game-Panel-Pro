(function () {

    if ((typeof getPanelRole === "function" ? getPanelRole() : null) === "customer") {
        const adminSections = document.querySelectorAll(
            ".referral-stats, .referral-generator, .referral-section"
        );
        adminSections.forEach((section) => section.remove());

        const intro = document.querySelector(".referral-page-intro");
        if (intro) {
            const heading = intro.querySelector("h1");
            const description = intro.querySelector("p:last-child");
            if (heading) heading.textContent = "Your Referral";
            if (description) description.textContent = "View the referral access assigned to your account.";
        }

        const view = document.getElementById("customerReferralView");
        const details = document.getElementById("customerReferralDetails");
        if (view) view.hidden = false;

        const escapeCustomerHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[char]));

        const formatCustomerDate = (value) => {
            if (!value) return "Not available";
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
        };

        (async () => {
            const token = localStorage.getItem("customerToken");
            if (!token) {
                if (details) details.innerHTML = '<p class="customer-referral-empty">Please sign in again to view your assigned referral.</p>';
                return;
            }

            try {
                const response = await fetch("/customer/referral/me", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await response.json();

                if (!response.ok || !data.success || !data.referral) {
                    if (details) details.innerHTML = `<p class="customer-referral-empty">${escapeCustomerHtml(data.message || "Your assigned referral could not be loaded.")}</p>`;
                    return;
                }

                const referral = data.referral;
                const status = String(referral.status || "active").toLowerCase();
                const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
                if (details) {
                    details.innerHTML = `
                        <div class="customer-referral-code-row">
                            <div>
                                <span class="customer-referral-label">Assigned referral code</span>
                                <strong class="customer-referral-code">${escapeCustomerHtml(referral.code)}</strong>
                            </div>
                            <button type="button" class="customer-referral-copy" id="copyOwnReferral">
                                <i class="fa-regular fa-copy"></i> Copy
                            </button>
                        </div>
                        <div class="customer-referral-meta-grid">
                            <div class="customer-referral-meta">
                                <span class="customer-referral-label">Status</span>
                                <strong class="customer-referral-status ${escapeCustomerHtml(status)}">${escapeCustomerHtml(statusLabel)}</strong>
                            </div>
                            <div class="customer-referral-meta">
                                <span class="customer-referral-label">Access valid until</span>
                                <strong>${escapeCustomerHtml(formatCustomerDate(referral.expiryAt))}</strong>
                            </div>
                            <div class="customer-referral-meta">
                                <span class="customer-referral-label">Assigned by</span>
                                <strong>${escapeCustomerHtml(referral.createdBy || "Admin")}</strong>
                            </div>
                            <div class="customer-referral-meta">
                                <span class="customer-referral-label">Assigned on</span>
                                <strong>${escapeCustomerHtml(formatCustomerDate(referral.createdAt))}</strong>
                            </div>
                        </div>
                        ${referral.note ? `<p class="customer-referral-admin-note"><span class="customer-referral-label">Admin note</span>${escapeCustomerHtml(referral.note)}</p>` : ""}
                    `;

                    document.getElementById("copyOwnReferral")?.addEventListener("click", async () => {
                        try {
                            await navigator.clipboard.writeText(referral.code);
                            if (typeof showToast === "function") showToast("Copied", "Your referral code has been copied.", "success");
                        } catch (_) {
                            if (typeof showToast === "function") showToast("Copy unavailable", "Please select and copy the code manually.", "error");
                        }
                    });
                }
            } catch (error) {
                console.error(error);
                if (details) details.innerHTML = '<p class="customer-referral-empty">Could not connect to the server. Please try again.</p>';
            }
        })();

        return;
    }

    const referralsList = document.getElementById("referralsList");
    const customersList = document.getElementById("customersList");
    const referralSearch = document.getElementById("referralSearch");
    let allReferrals = [];
    let allCustomers = [];

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[char]));
    }

    function fmtDate(d) {
        return new Date(d).toLocaleString();
    }

    function toLocalDateTimeValue(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const pad = (n) => String(n).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function localDateTimeToIso(value) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    function statusFor(r) {
        if (r.status === "used") return "used";
        if (r.status === "revoked") return "revoked";
        return new Date(r.expiryAt) <= new Date() ? "expired" : "active";
    }

    function referralItemHtml(r) {
        const status = statusFor(r);
        const used = r.status === "used";
        const editable = r.status !== "used" && r.status !== "revoked";
        const code = escapeHtml(r.code);
        const username = r.usedBy ? escapeHtml(r.usedBy.username) : "";
        const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

        return `
            <article class="referral-code-card referral-swipe-item" data-id="${escapeHtml(r._id)}" data-search="${escapeHtml(`${r.code} ${r.usedBy?.username || ""}`.toLowerCase())}" data-used="${used}">
                <button class="referral-delete-reveal" data-action="delete" aria-label="Delete referral ${code}">
                    <i class="fa-regular fa-trash-can"></i><span>Delete</span>
                </button>
                <div class="referral-swipe-content">
                    <div class="referral-card-main">
                        <div class="referral-card-topline">
                            <span class="referral-card-icon"><i class="fa-solid fa-ticket"></i></span>
                            <div class="referral-code-wrap">
                                <strong class="referral-code">${code}</strong>
                                <button class="referral-copy-icon" data-action="copy" type="button" aria-label="Copy referral code"><i class="fa-regular fa-copy"></i></button>
                            </div>
                            <span class="referral-status-badge ${status}">${statusLabel}</span>
                        </div>
                        <div class="referral-detail-row"><i class="fa-regular fa-calendar"></i><span>Expires ${escapeHtml(fmtDate(r.expiryAt))}</span></div>
                        ${r.usedBy ? `<div class="referral-detail-row"><i class="fa-regular fa-user"></i><span>Used by <strong>${username}</strong></span></div>` : `<div class="referral-detail-row"><i class="fa-regular fa-user"></i><span>Not redeemed yet</span></div>`}
                        ${used ? `<div class="referral-redeemed-note"><i class="fa-solid fa-circle-info"></i> Redeemed. Customer access expiry is managed separately.</div>` : ""}
                        ${editable ? `
                            <div class="referral-expiry-editor" hidden>
                                <label>
                                    <span>New expiry date &amp; time</span>
                                    <input type="datetime-local" class="referral-expiry-input" value="${toLocalDateTimeValue(r.expiryAt)}">
                                </label>
                                <div class="referral-expiry-editor-actions">
                                    <button type="button" data-action="save-expiry" class="expiry-save"><i class="fa-solid fa-check"></i> Save expiry</button>
                                    <button type="button" data-action="cancel-expiry">Cancel</button>
                                </div>
                                <small>Set an earlier date to expire this code immediately.</small>
                            </div>
                        ` : ""}
                        <div class="referral-card-actions">
                            ${editable ? `<button data-action="edit-expiry" class="expiry-edit"><i class="fa-regular fa-calendar"></i> Edit expiry</button>` : ""}
                            ${r.status === "active" ? `<button data-action="revoke" class="referral-action-danger"><i class="fa-solid fa-ban"></i> Revoke</button>` : ""}
                            ${!used ? `<button data-action="delete" class="referral-action-quiet"><i class="fa-regular fa-trash-can"></i> Delete</button>` : ""}
                        </div>
                    </div>
                </div>
            </article>
        `;
    }

    function updateReferralStats() {
        const total = allReferrals.length;
        const redeemed = allReferrals.filter((r) => r.status === "used").length;
        const activeUsers = allCustomers.filter((c) => c.status !== "disabled" && new Date(c.expiryAt) > new Date()).length;
        document.getElementById("referralTotalCount").textContent = total;
        document.getElementById("referralRedeemedCount").textContent = redeemed;
        document.getElementById("referralActiveCustomers").textContent = activeUsers;
        document.getElementById("customerActiveCount").textContent = `${activeUsers} active`;
    }

    function renderReferrals() {
        const query = (referralSearch?.value || "").trim().toLowerCase();
        const filtered = allReferrals.filter((r) => {
            const haystack = `${r.code || ""} ${r.usedBy?.username || ""}`.toLowerCase();
            return haystack.includes(query);
        });
        referralsList.innerHTML = filtered.length
            ? filtered.map(referralItemHtml).join("")
            : `<p class="cust-empty">${query ? "No matching referral codes." : "No referral codes yet."}</p>`;
    }

    function showListLoading(list, count = 4) {
        if (!list) return;
        list.innerHTML = Array.from({ length: count }, () => `<div class="gp-loading-card" style="min-height:78px;"></div>`).join("");
    }

    async function loadReferrals() {
        showListLoading(referralsList, 3);
        try {
            const res = await apiFetch("/referral");
            const data = await res.json();
            if (!data.success || !Array.isArray(data.referrals)) {
                referralsList.innerHTML = `<p class="cust-empty">Failed to load referral codes.</p>`;
                return;
            }
            allReferrals = data.referrals;
            renderReferrals();
            updateReferralStats();
        } catch (err) {
            console.error(err);
            referralsList.innerHTML = `<p class="cust-empty">Failed to load referral codes.</p>`;
        }
    }

    async function createReferral() {
        const expiryInput = document.getElementById("refExpiryAt");
        const expiryAt = localDateTimeToIso(expiryInput?.value || "");
        const btn = document.getElementById("createReferralBtn");

        if (!expiryAt || new Date(expiryAt) <= new Date()) {
            showToast("Error", "Choose a future expiry date and time.", "error");
            expiryInput?.focus();
            return;
        }

        btn.disabled = true;
        try {
            const res = await apiFetch("/referral", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ expiryAt })
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

    const createExpiryInput = document.getElementById("refExpiryAt");
    if (createExpiryInput && !createExpiryInput.value) {
        const defaultExpiry = new Date();
        defaultExpiry.setDate(defaultExpiry.getDate() + 30);
        createExpiryInput.value = toLocalDateTimeValue(defaultExpiry);
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
            try {
                await navigator.clipboard.writeText(code);
                showToast("Copied", code, "success");
            } catch (_) {
                showToast("Copy unavailable", "Select and copy the referral code manually.", "error");
            }
            return;
        }

        const expiryEditor = item.querySelector(".referral-expiry-editor");

        if (action === "edit-expiry") {
            if (expiryEditor) {
                expiryEditor.hidden = false;
                expiryEditor.querySelector("input")?.focus();
            }
            return;
        }

        if (action === "cancel-expiry") {
            if (expiryEditor) expiryEditor.hidden = true;
            return;
        }

        if (action === "save-expiry") {
            const input = expiryEditor?.querySelector(".referral-expiry-input");
            const expiryAt = localDateTimeToIso(input?.value || "");
            if (!expiryAt) {
                showToast("Error", "Choose a valid expiry date and time.", "error");
                input?.focus();
                return;
            }

            btn.disabled = true;
            try {
                const res = await apiFetch(`/referral/${id}/expiry`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ expiryAt })
                });
                const data = await res.json();
                if (!data.success) {
                    showToast("Error", data.message || "Could not update expiry.", "error");
                    return;
                }
                showToast("Expiry updated", "Referral code validity has been updated.", "success");
                await loadReferrals();
            } catch (err) {
                console.error(err);
                showToast("Error", "Server connection failed.", "error");
            } finally {
                btn.disabled = false;
            }
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
        const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
        const username = escapeHtml(c.username);
        return `
            <article class="customer-management-item" data-id="${escapeHtml(c._id)}">
                <span class="customer-avatar">${escapeHtml((c.username || "?").charAt(0).toUpperCase())}</span>
                <div class="customer-info">
                    <div class="customer-card-heading">
                        <strong class="customer-name">${username}</strong>
                        <span class="customer-status-pill ${status}"><i class="fa-solid fa-circle"></i>${statusLabel}</span>
                    </div>
                    <div class="customer-meta">Access until ${escapeHtml(fmtDate(c.expiryAt))}</div>
                    <div class="customer-expiry-editor" hidden>
                        <label>
                            <span>Set access expiry</span>
                            <input type="datetime-local" class="customer-expiry-input" value="${toLocalDateTimeValue(c.expiryAt)}">
                        </label>
                        <div class="customer-expiry-editor-actions">
                            <button type="button" data-action="save-expiry" class="customer-expiry-save"><i class="fa-solid fa-check"></i> Save date</button>
                            <button type="button" data-action="cancel-expiry">Cancel</button>
                        </div>
                        <small>Future date extends access. Past date reduces validity or expires access immediately.</small>
                    </div>
                    <div class="customer-actions">
                        <button data-action="set-expiry"><i class="fa-regular fa-calendar-days"></i> Set expiry</button>
                        ${c.status === "disabled" ? `<button data-action="enable"><i class="fa-solid fa-circle-check"></i> Enable</button>` : `<button data-action="disable" class="danger"><i class="fa-solid fa-ban"></i> Disable</button>`}
                        <button data-action="delete" class="danger"><i class="fa-regular fa-trash-can"></i> Delete</button>
                    </div>
                </div>
            </article>
        `;
    }

    async function loadCustomers() {
        showListLoading(customersList, 2);
        try {
            const res = await apiFetch("/customers");
            const data = await res.json();
            if (!data.success || !Array.isArray(data.customers)) {
                customersList.innerHTML = `<p class="cust-empty">Failed to load customers.</p>`;
                return;
            }
            allCustomers = data.customers;
            customersList.innerHTML = allCustomers.length
                ? allCustomers.map(customerItemHtml).join("")
                : `<p class="cust-empty">No customers yet.</p>`;
            updateReferralStats();
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

        const customerCard = btn.closest(".customer-management-item");
        const expiryEditor = customerCard?.querySelector(".customer-expiry-editor");

        if (action === "set-expiry") {
            if (expiryEditor) {
                expiryEditor.hidden = false;
                expiryEditor.querySelector("input")?.focus();
            }
            return;
        }

        if (action === "cancel-expiry") {
            if (expiryEditor) expiryEditor.hidden = true;
            return;
        }

        if (action === "save-expiry") {
            const input = expiryEditor?.querySelector(".customer-expiry-input");
            const expiryAt = localDateTimeToIso(input?.value || "");
            if (!expiryAt) {
                showToast("Error", "Choose a valid expiry date and time.", "error");
                input?.focus();
                return;
            }

            btn.disabled = true;
            try {
                const res = await apiFetch(`/customers/${id}/expiry`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ expiryAt })
                });
                const data = await res.json();
                if (!data.success) {
                    showToast("Error", data.message || "Could not update customer expiry.", "error");
                    return;
                }
                showToast("Access expiry updated", "Customer validity now matches the selected date and time.", "success");
                await loadCustomers();
            } catch (err) {
                console.error(err);
                showToast("Error", "Server connection failed.", "error");
            } finally {
                btn.disabled = false;
            }
            return;
        }

        let res;
        if (action === "disable" || action === "enable") {
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

    referralSearch?.addEventListener("input", renderReferrals);

    loadReferrals();
    loadCustomers();

})();
