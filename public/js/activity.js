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
            CREATE: ["🟢", "Key Created"],
            DELETE: ["🔴", "Key Deleted"],
            BAN: ["⛔", "Key Banned"],
            UNBAN: ["✅", "Key Unbanned"],
            EXTEND: ["📅", "License Extended"],
            RESET_DEVICE: ["📱", "Device Reset"]
        };

        container.innerHTML = data.activities.map((activity, index) => {
            const [icon, fallbackText] = actionMap[activity.action] || ["📌", activity.action];
            const text = activity.action === "CREATE"
                ? (activity.licenseType === "premium" ? "Premium Key Created" : "Public Key Created")
                : fallbackText;

            return `
                <div class="activity-item" style="animation-delay:${index * 60}ms;">
                    <div class="activity-title">
                        ${icon}
                        <strong>${text}</strong>
                    </div>
                    <div class="activity-key">${activity.licenseKey || "—"}</div>
                    <div class="activity-meta">
                        By ${activity.admin || "System"}
                        •
                        ${new Date(activity.createdAt).toLocaleString()}
                    </div>
                    ${activity.details ? `<div class="activity-meta">${activity.details}</div>` : ""}
                </div>
            `;
        }).join("");

    } catch (error) {
        console.error(error);
        container.innerHTML = `<p class="activity-empty activity-error">Failed to load activity.</p>`;
    }
}

loadActivityLogs();
