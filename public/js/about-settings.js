if (!localStorage.getItem("token")) {

    window.location.replace("/login");

}

if (typeof initSidebar === "function") {

    initSidebar();

}

function formatUptime(seconds) {

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];

    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);

    return parts.join(" ");

}

async function loadAboutInfo() {

    const token = localStorage.getItem("token");

    try {

        const res = await fetch("/settings/about/status", {

            headers: {

                Authorization: `Bearer ${token}`

            }

        });

        const data = await res.json();

        if (!data.success) return;

        const panelVersion = document.getElementById("panelVersion");
        const nodeVersion = document.getElementById("nodeVersion");
        const dbStatus = document.getElementById("dbStatus");
        const environment = document.getElementById("environment");
        const serverUptime = document.getElementById("serverUptime");

        if (panelVersion) panelVersion.value = data.panelVersion;
        if (nodeVersion) nodeVersion.value = data.nodeVersion;
        if (dbStatus) dbStatus.value = data.dbConnected ? "Connected" : "Disconnected";
        if (environment) environment.value = data.environment;
        if (serverUptime) serverUptime.value = formatUptime(data.uptime);

    }

    catch (error) {

        console.error(error);

    }

}

loadAboutInfo();
