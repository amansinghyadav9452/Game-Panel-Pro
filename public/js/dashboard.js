if (!localStorage.getItem("token")) {
    window.location.replace("/login");}

if (typeof initSidebar === "function") {
    initSidebar();
}
initAutoLogout();

async function loadStats() {

    try {

const response = await apiFetch("/dashboard");

        const data = await response.json();

if (!data.success) {

    showToast(data.message, "error");

    return;

}

        document.getElementById("totalKeys").textContent =
            data.stats.totalKeys;

        document.getElementById("activeKeys").textContent =
            data.stats.activeKeys;

        document.getElementById("expiredKeys").textContent =
            data.stats.expiredKeys;

        document.getElementById("bannedKeys").textContent =
            data.stats.bannedKeys;

    } catch (err) {

        console.error(err);

    }

}

loadStats();

async function loadRecentActivities() {

    try {

        const response = await apiFetch("/activity/recent");

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

data.activities.forEach((activity) => {

    const action =
        actionMap[activity.action] || {
            icon: "📌",
            text: activity.action
        };

    container.innerHTML += `

        <div class="activity-item">

            <div class="activity-title">

                ${action.icon}
                <strong>${action.text}</strong>

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

