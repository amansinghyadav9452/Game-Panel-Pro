if (!localStorage.getItem("token")) {

    window.location.replace("/login");

}

if (typeof initSidebar === "function") {

    initSidebar();

}

initAutoLogout();
let currentPage = 1;
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

async function loadLogs(page = currentPage) {

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

        const start = ((data.currentPage - 1) * limit) + 1;

        const end = Math.min(
            data.currentPage * limit,
            data.totalLogs
        );

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

    Showing ${start}-${end} of ${data.totalLogs} logs

</div>

<div class="logs-list">

`;

        data.logs.forEach(log => {
const success = log.status === "success";

html += `

<div class="log-card ${success ? "success" : "failed"}">

    <div class="status-line"></div>

<div class="log-top">

    <div class="device-icon">

        <i class="fas fa-mobile-alt"></i>

    </div>

    <div class="log-title">

        <div class="top-row">

            <h3>${log.licenseKey}</h3>

            <span class="status-pill ${success ? "success" : "failed"}">

                ${success ? "Success" : "Failed"}

            </span>

        </div>

        <div class="bottom-row">

            <span class="time">

                🕒 ${getLastSeen(log.createdAt)}

            </span>

        </div>

    </div>

</div>

<div class="log-grid">

    <div class="info-card">

        <span class="info-label">

            Device ID

        </span>

        <span class="info-value">

            ${log.serial || "-"}

        </span>

    </div>

    <div class="info-card">

        <span class="info-label">

            License Type

        </span>

        <span class="license-badge ${log.licenseType.toLowerCase()}">

            ${log.licenseType}

        </span>

    </div>

</div>

    <div class="reason-box">

        ${log.reason || "-"}

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

loadLogs(1);

setInterval(() => {

    loadLogs(currentPage);

}, 10000);