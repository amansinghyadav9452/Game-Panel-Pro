if (!localStorage.getItem("token")) {

    window.location.replace("/login");

}

if (typeof initSidebar === "function") {

    initSidebar();

}

async function loadDbStatus() {

    const statusInput = document.getElementById("dbStatus");

    if (!statusInput) return;

    const token = localStorage.getItem("token");

    try {

        const res = await fetch("/settings/database/status", {

            headers: {

                Authorization: `Bearer ${token}`

            }

        });

        const data = await res.json();

        if (data.success) {

            statusInput.value = data.connected
                ? `Connected (${data.collections} collections)`
                : "Disconnected";

        }

        else {

            statusInput.value = "Disconnected";

        }

    }

    catch (error) {

        console.error(error);

        statusInput.value = "Disconnected";

    }

}

loadDbStatus();

const backupBtn = document.getElementById("backupBtn");

if (backupBtn) {

    backupBtn.addEventListener("click", async () => {

        const token = localStorage.getItem("token");

        try {

            const response = await fetch("/settings/database/backup", {

                headers: {

                    Authorization: `Bearer ${token}`

                }

            });

            if (!response.ok) {

                const data = await response.json().catch(() => ({}));

                throw new Error(data.message || "Backup failed.");

            }

            const blob = await response.blob();

            const filename =
                `game-panel-backup-${new Date().toISOString().slice(0, 10)}.json`;

            const downloadUrl = window.URL.createObjectURL(blob);

            const link = document.createElement("a");

            link.href = downloadUrl;
            link.download = filename;

            document.body.appendChild(link);
            link.click();
            link.remove();

            window.URL.revokeObjectURL(downloadUrl);

            showToast("Success", "Backup downloaded successfully.", "success");

        }

        catch (error) {

            console.error(error);

            showToast("Error", error.message || "Backup failed.", "error");

        }

    });

}

const restoreBtn = document.getElementById("restoreBtn");
const restoreInput = document.getElementById("restoreInput");

if (restoreBtn && restoreInput) {

    restoreBtn.addEventListener("click", () => {

        restoreInput.click();

    });

    restoreInput.addEventListener("change", async () => {

        if (!restoreInput.files.length) return;

        const file = restoreInput.files[0];

        showConfirm(
            "Restore Database",
            "This will overwrite existing data with the contents of the backup file. This cannot be undone. Continue?",
            async () => {

                const token = localStorage.getItem("token");

                try {

                    const text = await file.text();

                    const response = await fetch("/settings/database/restore", {

                        method: "POST",

                        headers: {

                            "Content-Type": "application/json",

                            Authorization: `Bearer ${token}`

                        },

                        body: text

                    });

                    const data = await response.json();

                    if (!response.ok) {

                        throw new Error(data.message);

                    }

                    showToast("Success", data.message, "success");

                    loadDbStatus();

                }

                catch (error) {

                    console.error(error);

                    showToast("Error", error.message || "Restore failed.", "error");

                }

                finally {

                    restoreInput.value = "";

                }

            }
        );

    });

}

const clearCacheBtn = document.getElementById("clearCacheBtn");

if (clearCacheBtn) {

    clearCacheBtn.addEventListener("click", () => {

        showConfirm(
            "Clear Cache",
            "This will remove expired licenses and logs older than your retention period. Continue?",
            async () => {

                const token = localStorage.getItem("token");

                try {

                    const response = await fetch("/settings/database/clear-cache", {

                        method: "POST",

                        headers: {

                            Authorization: `Bearer ${token}`

                        }

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

            }
        );

    });

}
