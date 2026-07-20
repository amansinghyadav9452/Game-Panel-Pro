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

<div class="logs-info">

    Showing ${start}-${end} of ${data.totalLogs} logs

</div>
        <table class="logs-table">
            <thead>
                <tr>
                    <th>Last Seen</th>
                    <th>License Key</th>
                    <th>Device ID</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Reason</th>
                </tr>
            </thead>
            <tbody>
        `;

        data.logs.forEach(log => {

            html += `
                <tr>

                    <td>${getLastSeen(log.createdAt)}</td>

                    <td>${log.licenseKey}</td>

                    <td>${log.serial || "-"}</td>

                    <td>${log.licenseType}</td>

                    <td class="${log.status === "success"
                        ? "status-success"
                        : "status-failed"}">

                        ${log.status === "success" ? "✅ Success" : "❌ Failed"}

                    </td>

                    <td>${log.reason || "-"}</td>

                </tr>
            `;

        });

html += `
    </tbody>
</table>

<div class="logs-pagination">

    <button
        class="page-btn"
        ${data.currentPage === 1 ? "disabled" : ""}
        onclick="loadLogs(${data.currentPage - 1})">

        ← Previous

    </button>

    <span class="page-number">

        Page ${data.currentPage} of ${data.totalPages}

    </span>

    <button
        class="page-btn"
        ${data.currentPage === data.totalPages ? "disabled" : ""}
        onclick="loadLogs(${data.currentPage + 1})">

        Next →

    </button>

</div>
`;

        container.innerHTML = html;

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