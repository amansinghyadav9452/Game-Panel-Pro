if (!localStorage.getItem("token")) {

    window.location.replace("/login");

}

if (typeof initSidebar === "function") {

    initSidebar();

}

initAutoLogout();
let currentPage = 1;
let allLogs = [];
let bannedDevices = [];
let lastRenderSignature = null;
const limit = 100;

function getLastSeen(date) {

    const seconds = Math.floor((Date.now() - new Date(date)) / 1000);

    if (seconds < 10) return "Just now";

    if (seconds < 60) return `${seconds} sec ago`;

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);

    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;

    const days = Math.floor(hours / 24);

    if (days === 1) return "Yesterday";

    if (days < 7) return `${days} days ago`;

    return new Date(date).toLocaleString();

}

async function loadLogs(page = currentPage, isAutoRefresh = false) {

    currentPage = page;

    const container =
        document.getElementById("userLogsContainer");

    try {

        const token =
            localStorage.getItem("token");

        const response = await fetch(`/logs/recent?page=${page}&limit=${limit}`, {

            headers: {

                Authorization: `Bearer ${token}`

            }

        });

        const data = await response.json();
        const bannedResponse = await fetch("/api/banned-devices", {

    headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
    }

});

const bannedData = await bannedResponse.json();

bannedDevices = bannedData.map(device => device.serial);
        allLogs = data.logs;

        const successLogs = data.logs.filter(
    log => log.status === "success"
).length;

const failedLogs = data.logs.filter(
    log => log.status !== "success"
).length;

const premiumLogs = data.logs.filter(
    log => (log.licenseType || "").toLowerCase() === "premium"
).length;

const uniqueDevices = new Set(
    data.logs.map(log => log.serial)
).size;

        if (!data.success) {

            container.innerHTML =
                `<p style="color:#EF4444;">Failed to load logs.</p>`;

            return;

        }

        if (data.logs.length === 0) {

            container.innerHTML =
                `<p style="color:#94A3B8;">No logs found.</p>`;

            return;

        }

        // Naya data purane rendered data se compare karo.
        // Agar kuch nahi badla to DOM ko touch hi mat karo -
        // isse har 10 sec ke auto-refresh pe list "blink" nahi karegi.
        const signature = JSON.stringify({
            page: data.currentPage,
            banned: bannedDevices,
            logs: data.logs.map(l => `${l.serial}-${l.status}-${l.createdAt}`)
        });

        if (isAutoRefresh && signature === lastRenderSignature) {
            return;
        }

        lastRenderSignature = signature;

        const start = ((data.currentPage - 1) * limit) + 1;

        const end = Math.min(
            data.currentPage * limit,
            data.totalLogs
        );

        const rangeLabels = {
            live: "Live",
            "2h": "Last 2 Hours",
            "24h": "Last 24 Hours",
            "7d": "Last 7 Days",
            "1m": "Last 1 Month"
        };

        const rangeLabel = rangeLabels[data.range] || "Last 24 Hours";

let html = `

<div class="logs-stats">

    <div class="stat-card success">

        <div class="stat-number">

            ${successLogs}

        </div>

        <div class="stat-label">

            Success

        </div>

    </div>

    <div class="stat-card failed">

        <div class="stat-number">

            ${failedLogs}

        </div>

        <div class="stat-label">

            Failed

        </div>

    </div>

    <div class="stat-card premium">

        <div class="stat-number">

            ${premiumLogs}

        </div>

        <div class="stat-label">

            Premium

        </div>

    </div>

    <div class="stat-card devices">

        <div class="stat-number">

            ${uniqueDevices}

        </div>

        <div class="stat-label">

            Devices

        </div>

    </div>

</div>

<div class="logs-info">

    Showing ${start}-${end} of ${data.totalLogs} logs · ${rangeLabel}

</div>

<div class="logs-list">

`;

        data.logs.forEach((log, index) => {
const success = log.status === "success";

const isBanned = bannedDevices.includes(log.serial);

html += `

<div class="log-card ${success ? "success" : "failed"}" style="animation-delay:${index * 45}ms;">

    <div class="status-line"></div>

<div class="log-top">

<div
    class="device-action"
    data-serial="${log.serial}">

    <i class="fa-solid fa-mobile-screen-button"></i>

</div>

    <div class="log-title">

<div class="top-row">

    <h3>${log.licenseKey}</h3>

<span class="status-pill ${success ? "success" : "failed"}">

    ${success ? "Success" : "Failed"}

</span>

${
    isBanned
        ? `<span class="status-pill failed" title="This device's serial is currently in the banned list">🚫 Banned Device</span>`
        : ""
}

</div>

<div class="bottom-row">

    <span class="time">

        🕒 ${getLastSeen(log.createdAt)}

    </span>

    <span class="license-badge ${log.licenseType.toLowerCase()}">

        ${log.licenseType}

    </span>

</div>

    </div>

</div>

<div class="log-meta">

    ${(log.deviceMarketingName || log.deviceBrand) ? `
    <div class="meta-row">
        <span class="meta-label">
            Device :
        </span>
        <span class="meta-value">
            ${log.deviceMarketingName || [log.deviceBrand, log.deviceModel].filter(Boolean).join(" ") || "-"}
        </span>
    </div>
    ` : ""}

        ${log.androidVersion ? `
    <div class="meta-row">
        <span class="meta-label">
            Android :
        </span>
        <span class="meta-value">
            ${log.androidVersion}
        </span>
    </div>
    ` : ""}

    ${log.appVersion ? `
<div class="meta-row">
    <span class="meta-label">
        App :
    </span>
    <span class="meta-value">
        ${log.appVersion}
    </span>
</div>
` : ""}

    ${log.deviceModel ? `
    <div class="meta-row">
        <span class="meta-label">
            Model :
        </span>
        <span class="meta-value">
            ${log.deviceModel}
        </span>
    </div>
    ` : ""}

        <div class="meta-row">
        <span class="meta-label">
            ID :
        </span>
        <span class="meta-value">
            ${log.serial || "-"}
        </span>
    </div>

    ${!success && log.reason ? `

    <div class="meta-row reason">

        ${log.reason}

    </div>

    ` : ""}

</div>

</div>

`;

        });

html += `

</div>

<div class="logs-pagination">

    <button
        id="prevBtn"
        class="page-btn"
        ${data.currentPage === 1 ? "disabled" : ""}>

        ← Previous

    </button>

    <span class="page-number">

        Page ${data.currentPage} of ${data.totalPages}

    </span>

    <button
        id="nextBtn"
        class="page-btn"
        ${data.currentPage === data.totalPages ? "disabled" : ""}>

        Next →

    </button>

</div>
`;

        container.innerHTML = html;

        container.querySelectorAll(".device-action")
.forEach(button => {

    button.addEventListener("click", () => {

        showDeviceMenu(
            button.dataset.serial
        );

    });

});

        const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

if (prevBtn && !prevBtn.disabled) {

    prevBtn.addEventListener("click", () => {

        loadLogs(currentPage - 1);

    });

}

if (nextBtn && !nextBtn.disabled) {

    nextBtn.addEventListener("click", () => {

        loadLogs(currentPage + 1);

    });

}

    } catch (err) {

        console.error(err);

        container.innerHTML =
            `<p style="color:#EF4444;">Server Error.</p>`;

    }

}

function showDeviceMenu(serial){

    const log = allLogs.find(x => x.serial === serial);

    if(!log){
        return;
    }

    openBanModal(log);

}

function openBanModal(log){

    const deviceLabel =
        log.deviceMarketingName || log.deviceModel || "this device";

    showBanModal(deviceLabel, (reason) => {

        banDevice(log.serial, reason);

    });

}

async function banDevice(serial, reason = ""){

    try{

        const log = allLogs.find(
            x => x.serial === serial
        );

        if(!log){

            showToast(
                "Device not found",
                "error"
            );

            return;

        }

        const response = await fetch(
            "/api/banned-devices/ban",
            {

                method:"POST",
            headers:{

                "Content-Type":"application/json",

                Authorization:`Bearer ${localStorage.getItem("token")}`

            },

                body:JSON.stringify({

                    serial:log.serial,

                    userKey:log.licenseKey,

                    deviceBrand:log.deviceBrand,

                    deviceModel:log.deviceModel,

                    androidVersion:log.androidVersion,

                    appVersion:log.appVersion,

                    bannedBy:"Admin",

                    reason:reason || "No reason provided"

                })

            }
        );

        const data = await response.json();

        if(data.success){

            showToast(
                "Device banned successfully",
                "success"
            );

            await loadLogs(currentPage);

        }else{

            showToast(
                data.message,
                "error"
            );

        }

    }catch(e){

        showToast(
            "Unable to ban device",
            "error"
        );

    }

}

loadLogs(1);

setInterval(() => {

    loadLogs(currentPage, true);

}, 10000);