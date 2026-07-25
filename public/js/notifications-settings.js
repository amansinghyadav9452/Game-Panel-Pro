if (!localStorage.getItem("token")) {

    window.location.replace("/login");

}

if (typeof initSidebar === "function") {

    initSidebar();

}

const saveNotificationsBtn = document.getElementById("saveNotificationsBtn");

if (saveNotificationsBtn) {

    saveNotificationsBtn.addEventListener("click", async () => {

        const telegram =
            document.getElementById("telegram").value === "true";

        const discord =
            document.getElementById("discord").value === "true";

        const discordWebhookUrl =
            document.getElementById("discordWebhookUrl").value.trim();

        const email =
            document.getElementById("email").value === "true";

        const criticalOnly =
            document.getElementById("criticalOnly").value === "true";

        if (discord && discordWebhookUrl) {

            const isValidWebhook =
                /^https:\/\/discord(app)?\.com\/api\/webhooks\/.+/.test(
                    discordWebhookUrl
                );

            if (!isValidWebhook) {

                showToast("Error", "Enter a valid Discord webhook URL.", "error");

                return;

            }

        }

        const token = localStorage.getItem("token");

        try {

            const response = await fetch("/settings/notifications", {

                method: "PUT",

                headers: {

                    "Content-Type": "application/json",

                    Authorization: `Bearer ${token}`

                },

                body: JSON.stringify({

                    telegram,

                    discord,

                    discordWebhookUrl,

                    email,

                    criticalOnly

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
