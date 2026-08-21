if (!localStorage.getItem("token") && !localStorage.getItem("customerToken")) {
    window.location.replace("/login");}

if (typeof initSidebar === "function") {
    initSidebar();
}
initAutoLogout();

const __dashRole = (typeof getPanelRole === "function") ? getPanelRole() : (localStorage.getItem("token") ? "admin" : "customer");

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

        console.error(err);

        // Without this, a failed/hung request leaves the 4 stat boxes
        // stuck showing their loading skeleton forever — which keeps
        // an infinite shimmer animation running on all 4 permanently,
        // making the dashboard feel laggy just by sitting there.
        stopStatSkeletons();

    }

}

function stopStatSkeletons() {

    ["totalKeys", "activeKeys", "expiredKeys", "bannedKeys"].forEach((id) => {

        const el = document.getElementById(id);

        if (!el) return;

        el.classList.remove("gp-skeleton");

        if (el.textContent.trim() === "0" || el.textContent.trim() === "") {
            el.textContent = "—";
        }

    });

}

loadStats();

async function loadRecentActivities() {

    try {

        const response = await apiFetch(__dashRole === "customer" ? "/customer/dashboard/recent-activity" : "/activity/recent");

        const data = await response.json();

        const container =
            document.getElementById("recentActivityList");

        if (!container) return;

        if (!data.success || data.activities.length === 0) {

            container.innerHTML = `

                <p style="color:#94A3B8;">

                    No recent activity yet.

                </p>

            `;

            return;

        }

        container.innerHTML = "";

                const actionMap = {

    CREATE: {
        icon: "🟢",
        text: "Public Key Created"
    },

    DELETE: {
        icon: "🔴",
        text: "Key Deleted"
    },

    BAN: {
        icon: "⛔",
        text: "Key Banned"
    },

    UNBAN: {
        icon: "✅",
        text: "Key Unbanned"
    },

    EXTEND: {
        icon: "📅",
        text: "License Extended"
    },

    RESET_DEVICE: {
        icon: "📱",
        text: "Device Reset"
    }

};

data.activities.forEach((activity, index) => {

    const action =
        actionMap[activity.action] || {
            icon: "📌",
            text: activity.action
        };

        let actionText = action.text;

if (activity.action === "CREATE") {

    actionText =
        activity.licenseType === "premium"
            ? "Premium Key Created"
            : "Public Key Created";

}

    container.innerHTML += `

        <div class="activity-item" style="animation-delay:${index * 60}ms;">

            <div class="activity-title">

                ${action.icon}
                <strong>${actionText}</strong>

            </div>

            <div class="activity-key">

                ${activity.licenseKey}

            </div>

            <div class="activity-meta">

                By ${activity.admin}

                •

                ${new Date(activity.createdAt).toLocaleString()}

            </div>

        </div>

    `;

});

    } catch (err) {

        console.error(err);

    }

}

loadRecentActivities();
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
        }
    } catch (err) {
        console.error("Customer Game ID load error:", err);
    }
}

loadCustomerGameId();


