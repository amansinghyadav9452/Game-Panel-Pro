if (!localStorage.getItem("token") && !localStorage.getItem("customerToken")) {
    window.location.replace("/login");
}

if (typeof initSidebar === "function") {
    initSidebar();
}

initAutoLogout();

const __activityRole = (typeof getPanelRole === "function")
    ? getPanelRole()
    : (localStorage.getItem("token") ? "admin" : "customer");

function escapeActivityText(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
}

async function loadActivityLogs() {

    const container = document.getElementById("activityLogsContainer");
    if (!container) return;

    if (window.GPLoading) {
        GPLoading.show(container, "activity");
    }

    try {

        const endpoint = __activityRole === "customer"
            ? "/customer/dashboard/recent-activity"
            : "/activity/recent";

        const response = await apiFetch(endpoint);
        const data = await response.json();

        if (!data.success || !Array.isArray(data.activities) || !data.activities.length) {
            container.innerHTML = `<p class="activity-empty">No activity found.</p>`;
            return;
        }

        const actionMap = {
            CREATE: ["fa-solid fa-layer-group", "Key Created"],
            DELETE: ["fa-regular fa-trash-can", "Key Deleted"],
            BAN: ["fa-solid fa-ban", "Key Banned"],
            UNBAN: ["fa-solid fa-key", "Key Unbanned"],
            EXTEND: ["fa-regular fa-calendar-check", "License Extended"],
            RESET_DEVICE: ["fa-solid fa-mobile-screen-button", "Device Reset"]
        };

        container.innerHTML = data.activities.map((activity, index) => {
            const [icon, fallbackText] = actionMap[activity.action] || ["fa-regular fa-circle-check", activity.action];
            const text = activity.action === "CREATE"
                ? (activity.licenseType === "premium" ? "Premium Key Created" : "Public Key Created")
                : fallbackText;

            return `
                <div class="activity-item" style="animation-delay:${index * 60}ms;">
                    <div class="activity-title">
                        <i class="${icon}" aria-hidden="true"></i>
                        <strong>${escapeActivityText(text)}</strong>
                    </div>
                    <div class="activity-key">${escapeActivityText(activity.licenseKey || "—")}</div>
                    <div class="activity-meta">
                        By ${escapeActivityText(activity.admin || "System")}
                        •
                        ${escapeActivityText(new Date(activity.createdAt).toLocaleString())}
                    </div>
                    ${activity.details ? `<div class="activity-meta">${escapeActivityText(activity.details)}</div>` : ""}
                </div>
            `;
        }).join("");

    } catch (error) {
        console.error(error);
        container.innerHTML = `<p class="activity-empty activity-error">Failed to load activity.</p>`;
    }
}

loadActivityLogs();
