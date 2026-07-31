if (!localStorage.getItem("token")) {

    window.location.replace("/login");

}

if (typeof initSidebar === "function") {

    initSidebar();

}

const saveBtn = document.getElementById("saveLicenseBtn");

if (saveBtn) {

    saveBtn.addEventListener("click", async () => {

        const publicExpiry =
            Number(document.getElementById("publicExpiry").value);

        const premiumExpiry =
            Number(document.getElementById("premiumExpiry").value);

        const maxDevices =
            Number(document.getElementById("maxDevices").value);

        const licenseLength =
            Number(document.getElementById("licenseLength").value);

        const autoUppercase =
            document.getElementById("autoUppercase").value === "true";

        if (
            !Number.isFinite(publicExpiry) || publicExpiry < 0 || publicExpiry > 3650 ||
            !Number.isFinite(premiumExpiry) || premiumExpiry < 0 || premiumExpiry > 3650
        ) {

            showToast("Error", "Expiry must be between 0 and 3650 days.", "error");

            return;

        }

        if (!Number.isFinite(maxDevices) || maxDevices < 1 || maxDevices > 100) {

            showToast("Error", "Maximum devices must be between 1 and 100.", "error");

            return;

        }

        if (!Number.isFinite(licenseLength) || licenseLength < 6 || licenseLength > 32) {

            showToast("Error", "License length must be between 6 and 32.", "error");

            return;

        }

        const originalHtml = saveBtn.innerHTML;

        saveBtn.disabled = true;

        saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

        const token = localStorage.getItem("token");

        try {

            const response = await fetch("/settings/license", {

                method: "PUT",

                headers: {

                    "Content-Type": "application/json",

                    Authorization: `Bearer ${token}`

                },

                body: JSON.stringify({

                    publicExpiry,

                    premiumExpiry,

                    maxDevices,

                    licenseLength,

                    autoUppercase

                })

            });

            const data = await response.json();

            if (!response.ok || !data.success) {

                throw new Error(data.message || "Something went wrong.");

            }

            showToast("Success", data.message, "success");

        }

        catch (error) {

            console.error(error);

            showToast("Error", error.message || "Something went wrong.", "error");

        }

        finally {

            saveBtn.disabled = false;

            saveBtn.innerHTML = originalHtml;

        }

    });

}
