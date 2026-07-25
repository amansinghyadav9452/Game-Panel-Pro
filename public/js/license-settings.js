if (!localStorage.getItem("token")) {

    window.location.replace("/login");

}

if (typeof initSidebar === "function") {

    initSidebar();

}

const saveBtn = document.getElementById("saveLicenseBtn");

if (saveBtn) {

    saveBtn.addEventListener("click", async () => {

        const publicPrefix =
            document.getElementById("publicPrefix").value.trim();

        const premiumPrefix =
            document.getElementById("premiumPrefix").value.trim();

        const publicExpiry =
            document.getElementById("publicExpiry").value;

        const premiumExpiry =
            document.getElementById("premiumExpiry").value;

        const maxDevices =
            document.getElementById("maxDevices").value;

        const licenseLength =
            document.getElementById("licenseLength").value;

        const autoUppercase =
            document.getElementById("autoUppercase").value === "true";

        if (!publicPrefix || !premiumPrefix) {

            showToast("Error", "Prefixes cannot be empty.", "error");

            return;

        }

        const token = localStorage.getItem("token");

        try {

            const response = await fetch("/settings/license", {

                method: "PUT",

                headers: {

                    "Content-Type": "application/json",

                    Authorization: `Bearer ${token}`

                },

                body: JSON.stringify({

                    publicPrefix,

                    premiumPrefix,

                    publicExpiry,

                    premiumExpiry,

                    maxDevices,

                    licenseLength,

                    autoUppercase

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
