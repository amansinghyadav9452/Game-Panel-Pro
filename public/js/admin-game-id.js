(() => {
    const input = document.getElementById("adminGameId");
    const saveBtn = document.getElementById("saveAdminGameId");
    const status = document.getElementById("adminGameIdStatus");
    if (!input || !saveBtn) return;

    const showStatus = (message, type = "") => {
        if (!status) return;
        status.textContent = message;
        status.className = `admin-game-id-status ${type}`.trim();
    };

    input.addEventListener("input", () => {
        input.value = input.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
        showStatus("");
    });

    const loadGameId = async () => {
        try {
            const response = await fetch("/settings/game-id", { credentials: "same-origin" });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || "Failed to load Game ID.");
            input.value = data.gameId || "";
        } catch (error) {
            showStatus(error.message || "Failed to load Game ID.", "error");
        }
    };

    saveBtn.addEventListener("click", async () => {
        const gameId = input.value.trim().toUpperCase();
        if (!gameId) { showStatus("Game ID is required.", "error"); input.focus(); return; }
        if (gameId.length < 12 || gameId.length > 64) { showStatus("Game ID must be 12–64 characters.", "error"); input.focus(); return; }
        saveBtn.disabled = true;
        const originalText = saveBtn.textContent;
        saveBtn.textContent = "Saving...";
        showStatus("");
        try {
            const response = await fetch("/settings/game-id", {
                method: "PUT", credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ gameId })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || data.error || "Failed to save Game ID.");
            input.value = data.gameId || gameId;
            showStatus("Game ID saved successfully.", "success");
        } catch (error) {
            showStatus(error.message || "Failed to save Game ID.", "error");
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    });

    loadGameId();
})();
