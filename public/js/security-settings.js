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

const currentPassword =
    document.getElementById("removeBiometricPassword").value.trim();

if (!currentPassword) {

    showToast(
        "Error",
        "Current password is required.",
        "error"
    );

    return;

}

    try {

        const response = await fetch("/settings/security", {

            method: "PUT",

headers: {

    "Content-Type": "application/json",

    Authorization: `Bearer ${token}`

},

body: JSON.stringify({

    currentPassword,

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

const registrationResponse =
await SimpleWebAuthnBrowser.startRegistration({
    optionsJSON: options
});

            console.log(registrationResponse);

            const verifyResponse = await fetch(
    "/api/webauthn/register/verify",
    {
        method: "POST",

        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },

        body: JSON.stringify(registrationResponse)
    }
);

const result = await verifyResponse.json();

console.log(result);

if (!verifyResponse.ok || !result.success) {

    showToast(
        "Error",
        result.message || "Biometric registration failed.",
        "error"
    );

    return;
}

showToast(
    "Success",
    "Biometric enabled successfully.",
    "success"
);

        } catch (err) {

            console.error(err);

            showToast("Biometric registration cancelled.", "error");

        }

    });

}

const removeBiometricBtn =
    document.getElementById("removeBiometricBtn");

if (removeBiometricBtn) {

    removeBiometricBtn.addEventListener("click", async () => {

        try {

            const token = localStorage.getItem("token");

            const response = await fetch(

                "/settings/security/biometric",

                {

                    method: "DELETE",

                    headers: {

                        Authorization: `Bearer ${token}`

                    }

                }

            );

            const result = await response.json();

            if (!response.ok) {

                throw new Error(result.message);

            }

            showToast(

                "Success",

                result.message,

                "success"

            );

        }

        catch (error) {

            console.error(error);

            showToast(

                "Error",

                "Unable to remove biometric.",

                "error"

            );

        }

    });

}