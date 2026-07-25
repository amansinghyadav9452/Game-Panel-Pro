if (!localStorage.getItem("token")) {

    window.location.replace("/login");

}

if (typeof initSidebar === "function") {

    initSidebar();

}

const saveAppearanceBtn = document.getElementById("saveAppearanceBtn");

if (saveAppearanceBtn) {

    saveAppearanceBtn.addEventListener("click", async () => {

        const darkMode =
            document.getElementById("darkMode").value === "true";

        const accentColor =
            document.getElementById("accentColor").value;

        const sidebarCollapsed =
            document.getElementById("sidebarCollapsed").value === "true";

        const animationsEnabled =
            document.getElementById("animationsEnabled").value === "true";

        const token = localStorage.getItem("token");

        try {

            const response = await fetch("/settings/appearance", {

                method: "PUT",

                headers: {

                    "Content-Type": "application/json",

                    Authorization: `Bearer ${token}`

                },

                body: JSON.stringify({

                    darkMode,

                    accentColor,

                    sidebarCollapsed,

                    animationsEnabled

                })

            });

            const data = await response.json();

            if (!response.ok) {

                throw new Error(data.message);

            }

            if (typeof applyAppearanceSettings === "function") {

                applyAppearanceSettings({

                    darkMode,

                    accentColor,

                    sidebarCollapsed,

                    animationsEnabled

                });

            }

            showToast("Success", data.message, "success");

        }

        catch (error) {

            console.error(error);

            showToast("Error", error.message || "Something went wrong.", "error");

        }

    });

}
