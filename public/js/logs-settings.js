if (!localStorage.getItem("token")) {

    window.location.replace("/login");

}

if (typeof initSidebar === "function") {

    initSidebar();

}

async function downloadCsv(url, filenameFallback) {

    const token = localStorage.getItem("token");

    try {

        const response = await fetch(url, {

            headers: {

                Authorization: `Bearer ${token}`

            }

        });

        if (!response.ok) {

            const data = await response.json().catch(() => ({}));

            throw new Error(data.message || "Export failed.");

        }

        const blob = await response.blob();

        const disposition = response.headers.get("Content-Disposition") || "";

        const match = disposition.match(/filename="?([^"]+)"?/);

        const filename = match ? match[1] : filenameFallback;

        const downloadUrl = window.URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = downloadUrl;

        link.download = filename;

        document.body.appendChild(link);

        link.click();

        link.remove();

        window.URL.revokeObjectURL(downloadUrl);

        showToast("Success", "Download started.", "success");

    }

    catch (error) {

        console.error(error);

        showToast("Error", error.message || "Something went wrong.", "error");

    }

}

const exportLogsBtn = document.getElementById("exportLogsBtn");

if (exportLogsBtn) {

    exportLogsBtn.addEventListener("click", () => {

        downloadCsv("/logs/export?type=all", "user-logs.csv");

    });

}

const downloadErrorsBtn = document.getElementById("downloadErrorsBtn");

if (downloadErrorsBtn) {

    downloadErrorsBtn.addEventListener("click", () => {

        downloadCsv("/logs/export?type=errors", "error-logs.csv");

    });

}

const saveBtn = document.getElementById("saveLogsBtn");

if (saveBtn) {

    saveBtn.addEventListener("click", async () => {

        const retentionDays =
            document.getElementById("retentionDays").value;

        const displayRange =
            document.getElementById("displayRange").value;

        const token = localStorage.getItem("token");

        try {

            const response = await fetch("/settings/logs", {

                method: "PUT",

                headers: {

                    "Content-Type": "application/json",

                    Authorization: `Bearer ${token}`

                },

                body: JSON.stringify({

                    retentionDays,

                    displayRange

                })

            });

            const data = await response.json();

            if (!response.ok) {

                throw new Error(data.message);

            }

            showToast("Success", data.message, "success");

        }

        catch (error) {

            console.error(error);

            showToast("Error", error.message || "Something went wrong.", "error");

        }

    });

}