(() => {
    const card = document.getElementById("adminGameIdCard");
    const input = document.getElementById("adminGameId");
    const saveBtn = document.getElementById("saveAdminGameId");
    const editBtn = document.getElementById("editAdminGameId");
    const cancelBtn = document.getElementById("cancelAdminGameId");
    const editor = document.getElementById("adminGameIdEditor");
    const savedState = document.getElementById("adminGameIdSaved");
    const description = document.getElementById("adminGameIdDescription");
    const status = document.getElementById("adminGameIdStatus");

    if (!card || !input || !saveBtn || !editor || !editBtn) return;

    let savedGameId = "";
    let isSaving = false;

    const showStatus = (message = "", type = "") => {
        if (!status) return;
        status.textContent = message;
        status.className = `admin-game-id-status ${type}`.trim();
    };

    const setLoading = (loading) => {
        isSaving = loading;
        saveBtn.disabled = loading;
        saveBtn.classList.toggle("is-loading", loading);
        saveBtn.innerHTML = loading
            ? '<span class="game-id-spinner" aria-hidden="true"></span> Saving...'
            : (savedGameId ? "Update" : "Save");
    };

    const showSavedState = () => {
        editor.hidden = true;
        savedState.hidden = false;
        editBtn.hidden = false;
        cancelBtn.hidden = true;
        description.textContent = "Your Game ID is linked to this admin account.";
        showStatus("");
        card.classList.add("has-game-id");
    };

    const showCreateState = () => {
        savedState.hidden = true;
        editor.hidden = false;
        editBtn.hidden = true;
        cancelBtn.hidden = true;
        description.textContent = "Set the Game ID used by your game build and admin licenses.";
        input.value = "";
        saveBtn.textContent = "Save";
        showStatus("");
        card.classList.remove("has-game-id");
    };

    const openEditor = () => {
        input.value = savedGameId;
        savedState.hidden = true;
        editor.hidden = false;
        editBtn.hidden = true;
        cancelBtn.hidden = false;
        saveBtn.textContent = "Update";
        description.textContent = "Edit the Game ID assigned to this admin account.";
        showStatus("");
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    };

    const loadGameId = async () => {
        try {
            const response = await apiFetch("/settings/game-id");
            const data = await response.json().catch(() => ({}));

            if (!response.ok || data.success === false) {
                throw new Error(data.message || data.error || "Failed to load Game ID.");
            }

            savedGameId = String(data.gameId || "").trim().toUpperCase();

            if (savedGameId) {
                showSavedState();
            } else {
                showCreateState();
            }
        } catch (error) {
            console.error("Admin Game ID load error:", error);
            description.textContent = "Unable to check saved Game ID.";
            editor.hidden = true;
            savedState.hidden = true;
            editBtn.hidden = true;
            showStatus(error.message || "Failed to load Game ID. Refresh and try again.", "error");
        }
    };

    input.addEventListener("input", () => {
        input.value = input.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
        input.classList.remove("input-error");
        showStatus("");
    });

    editBtn.addEventListener("click", openEditor);

    cancelBtn.addEventListener("click", () => {
        if (isSaving) return;
        input.value = savedGameId;
        showSavedState();
    });

    saveBtn.addEventListener("click", async () => {
        const gameId = input.value.trim().toUpperCase();

        if (!gameId) {
            input.classList.add("input-error");
            showStatus("Please enter a Game ID.", "error");
            input.focus();
            return;
        }

        if (gameId.length < 12 || gameId.length > 64) {
            input.classList.add("input-error");
            showStatus("Game ID must be 12–64 characters.", "error");
            input.focus();
            return;
        }

        if (!/^[A-Z0-9_-]+$/.test(gameId)) {
            input.classList.add("input-error");
            showStatus("Only A-Z, 0-9, _ and - are allowed.", "error");
            input.focus();
            return;
        }

        input.classList.remove("input-error");
        setLoading(true);
        showStatus("");

        try {
            const response = await apiFetch("/settings/game-id", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ gameId })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || data.success === false) {
                throw new Error(data.message || data.error || "Failed to save Game ID.");
            }

            savedGameId = String(data.gameId || gameId).trim().toUpperCase();
            input.classList.add("input-success");
            showSavedState();
            showStatus("Game ID updated successfully.", "success");

            window.setTimeout(() => input.classList.remove("input-success"), 700);
        } catch (error) {
            console.error("Admin Game ID save error:", error);
            showStatus(error.message || "Failed to save Game ID.", "error");
        } finally {
            setLoading(false);
        }
    });

    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !saveBtn.disabled) {
            event.preventDefault();
            saveBtn.click();
        }

        if (event.key === "Escape" && !cancelBtn.hidden) {
            cancelBtn.click();
        }
    });

    loadGameId();
})();
