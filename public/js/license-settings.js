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

        try {

            const response = await fetch("/license", {

                method: "PUT",

                headers: {

                    "Content-Type": "application/json"

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

            alert(data.message);

        }

        catch (error) {

            console.error(error);

            alert("Something went wrong.");

        }

    });

}