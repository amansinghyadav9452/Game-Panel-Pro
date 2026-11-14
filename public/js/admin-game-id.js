(() => {
    const input = document.getElementById("adminGameId");
    const saveBtn = document.getElementById("saveAdminGameId");
    const status = document.getElementById("adminGameIdStatus");

    if (!input || !saveBtn) return;

    const showStatus = (message = "", type = "") => {
        if (!status) return;

        status.textContent = message;
        status.className = `admin-game-id-status ${type}`.trim();
    };

    const setLoading = (loading) => {
        saveBtn.disabled = loading;
        saveBtn.classList.toggle("is-loading", loading);

        if (loading) {
            saveBtn.dataset.originalText = saveBtn.textContent;
            saveBtn.innerHTML = `
                <span class="game-id-spinner"></span>
                Saving...
            `;
        } else {
            saveBtn.textContent =
                saveBtn.dataset.originalText || "Save";
        }
    };

    // Clean and normalize Game ID while typing
    input.addEventListener("input", () => {
        input.value = input.value
            .toUpperCase()
            .replace(/[^A-Z0-9_-]/g, "");

        input.classList.remove("input-error");
        showStatus("");
    });

    // Load existing Admin Game ID
    const loadGameId = async () => {
        try {
            /*
             * IMPORTANT:
             * Use the project's existing apiFetch().
             * It automatically attaches the admin token from localStorage.
             */
            const response = await apiFetch("/settings/game-id");

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    data.error ||
                    "Failed to load Game ID."
                );
            }

            input.value = data.gameId || "";

        } catch (error) {
            console.error("Admin Game ID load error:", error);

            showStatus(
                error.message || "Failed to load Game ID.",
                "error"
            );
        }
    };

    // Save Game ID
    saveBtn.addEventListener("click", async () => {
        const gameId = input.value.trim().toUpperCase();

        // Required
        if (!gameId) {
            input.classList.add("input-error");

            showStatus(
                "Please enter a Game ID.",
                "error"
            );

            input.focus();
            return;
        }

        // Length
        if (gameId.length < 12 || gameId.length > 64) {
            input.classList.add("input-error");

            showStatus(
                "Game ID must be 12–64 characters.",
                "error"
            );

            input.focus();
            return;
        }

        // Allowed characters
        if (!/^[A-Z0-9_-]+$/.test(gameId)) {
            input.classList.add("input-error");

            showStatus(
                "Only A-Z, 0-9, _ and - are allowed.",
                "error"
            );

            input.focus();
            return;
        }

        input.classList.remove("input-error");

        setLoading(true);
        showStatus("");

        try {
            /*
             * IMPORTANT:
             * apiFetch automatically sends:
             *
             * Authorization: Bearer <admin token>
             */
            const response = await apiFetch(
                "/settings/game-id",
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        gameId
                    })
                }
            );

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    data.error ||
                    "Failed to save Game ID."
                );
            }

            input.value = data.gameId || gameId;

            showStatus(
                "✓ Game ID saved successfully.",
                "success"
            );

            // Small success animation
            input.classList.add("input-success");

            setTimeout(() => {
                input.classList.remove("input-success");
            }, 700);

        } catch (error) {
            console.error("Admin Game ID save error:", error);

            showStatus(
                error.message || "Failed to save Game ID.",
                "error"
            );

        } finally {
            setLoading(false);
        }
    });

    // Enter key = Save
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();

            if (!saveBtn.disabled) {
                saveBtn.click();
            }
        }
    });

    loadGameId();
})();