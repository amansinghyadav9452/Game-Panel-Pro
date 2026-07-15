const saveBtn = document.getElementById("saveApiBtn");

if (saveBtn) {

    saveBtn.addEventListener("click", async () => {

        const publicApiEnabled =
            document.getElementById("publicApiEnabled").value === "true";

        const premiumApiEnabled =
            document.getElementById("premiumApiEnabled").value === "true";

        const maintenanceMode =
            document.getElementById("maintenanceMode").value === "true";

        const rateLimit =
            document.getElementById("rateLimit").value;

        try {

            const response = await fetch("/settings/api", {

                method: "PUT",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify({

                    publicApiEnabled,

                    premiumApiEnabled,

                    maintenanceMode,

                    rateLimit

                })

            });

            const data = await response.json();

            if (!response.ok) {

                throw new Error(data.message);

            }

            showToast(

                "Success",

                data.message,

                "success"

            );

        }

        catch (error) {

            showToast(

                "Error",

                error.message,

                "error"

            );

        }

    });

}