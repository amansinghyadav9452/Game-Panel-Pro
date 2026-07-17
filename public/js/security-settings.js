const saveBtn = document.getElementById("saveSecurityBtn");

saveBtn.addEventListener("click", async () => {

    const turnstileEnabled =
        document.getElementById("turnstileEnabled").value === "true";

    const forceSingleLogin =
        document.getElementById("forceSingleLogin").value === "true";

    const sessionTimeout =
        document.getElementById("sessionTimeout").value;

    const jwtExpiry =
        document.getElementById("jwtExpiry").value;

    const rateLimit =
        document.getElementById("rateLimit").value;

    try {

        const response = await fetch("/security", {

            method: "PUT",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

                turnstileEnabled,

                forceSingleLogin,

                sessionTimeout,

                jwtExpiry,

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

        console.error(error);

        showToast(

    "Error",

    "Something went wrong.",

    "error"

);

    }

});

const enableBiometricBtn = document.getElementById("enableBiometricBtn");

if (enableBiometricBtn) {

    enableBiometricBtn.addEventListener("click", async () => {

        try {

const token = localStorage.getItem("token");

const optionsResponse = await fetch(
    "/api/webauthn/register/options",
    {
        method: "POST",

        headers: {
            Authorization: `Bearer ${token}`
        }
    }
);

            const options = await optionsResponse.json();

            if (!options.success) {

                showToast(options.message || "Unable to start biometric registration", "error");
                return;

            }

            const registrationResponse =
                await SimpleWebAuthnBrowser.startRegistration({
                    optionsJSON: options.options
                });

            console.log(registrationResponse);

        } catch (err) {

            console.error(err);

            showToast("Biometric registration cancelled.", "error");

        }

    });

}