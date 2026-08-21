/* ============================================================
   ACCESS CONSOLE LOADING HELPERS
============================================================ */

(function () {

    function resolveTarget(target) {
        if (!target) return null;
        return typeof target === "string"
            ? document.querySelector(target)
            : target;
    }

    function line(width = "100%") {
        return `<div class="gp-loading-line" style="width:${width}"></div>`;
    }

    function logCards(count = 4) {
        return Array.from({ length: count }, (_, i) => `
            <div class="gp-loading-card" style="animation-delay:${i * 45}ms;"></div>
        `).join("");
    }

    function licenseRows(count = 6) {
        return Array.from({ length: count }, () => `
            <tr class="gp-loading-table-row">
                <td><span class="gp-loading-table-cell" style="width:78%"></span></td>
                <td><span class="gp-loading-table-cell" style="width:62%"></span></td>
                <td><span class="gp-loading-table-cell" style="width:70%"></span></td>
                <td><span class="gp-loading-table-cell" style="width:45%"></span></td>
                <td><span class="gp-loading-table-cell" style="width:72%"></span></td>
            </tr>
        `).join("");
    }

    function licenseCards(count = 3) {
        return Array.from({ length: count }, () => `
            <div class="gp-loading-license-card gp-loading-card"></div>
        `).join("");
    }

    function show(target, type = "list") {

        const el = resolveTarget(target);
        if (!el) return;

        el.classList.add("gp-loading-host");

        if (type === "logs") {
            el.innerHTML = `
                <div class="logs-stats">
                    <div class="gp-loading-stat"></div>
                    <div class="gp-loading-stat"></div>
                    <div class="gp-loading-stat"></div>
                    <div class="gp-loading-stat"></div>
                </div>
                <div style="margin:18px 0;">
                    ${line("42%")}
                </div>
                <div class="logs-list">
                    ${logCards(5)}
                </div>
            `;
            return;
        }

        if (type === "activity") {
            el.innerHTML = `
                ${line("38%")}
                ${logCards(5)}
            `;
            return;
        }

        if (type === "banned") {
            el.innerHTML = `
                ${line("30%")}
                <div class="logs-list">
                    ${logCards(5)}
                </div>
            `;
            return;
        }

        if (type === "licenses") {
            const table = el.querySelector("#licenseTable") || el;
            const mobile = el.querySelector("#mobileLicenseList");
            table.innerHTML = licenseRows();
            if (mobile) mobile.innerHTML = licenseCards();
            return;
        }

        el.innerHTML = logCards();
    }

    function clear(target) {
        const el = resolveTarget(target);
        if (el) el.classList.remove("gp-loading-host");
    }

    window.GPLoading = { show, clear };

})();
