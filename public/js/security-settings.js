if (!localStorage.getItem("token")) {

    window.location.replace("/login");

}

if (typeof initSidebar === "function") {

    initSidebar();

}

const biometricBadge = document.getElementById("biometricBadge");
const enableBiometricButton = document.getElementById("enableBiometricBtn");
const removeBiometricButton = document.getElementById("removeBiometricBtn");

function renderBiometricStatus(enabled) {

    if (biometricBadge) {

        biometricBadge.textContent = enabled ? "Enabled" : "Disabled";

        biometricBadge.classList.toggle("warning", !enabled);
        biometricBadge.classList.toggle("success", enabled);

    }

    if (enableBiometricButton) {

        enableBiometricButton.style.display = enabled ? "none" : "";

    }

    if (removeBiometricButton) {

        removeBiometricButton.style.display = enabled ? "" : "none";

    }

}

async function loadBiometricStatus() {

    const token = localStorage.getItem("token");

    try {

        const response = await fetch("/settings/security/status", {

            headers: {
                Authorization: `Bearer ${token}`
            }

        });

        const data = await response.json();

        if (data.success) {

            renderBiometricStatus(data.biometricEnabled);

        }

    }

    catch (error) {

        console.error(error);

    }

}

loadBiometricStatus();

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

        const currentPassword = await requestPassword();

if (!currentPassword) {

    return;

}
    const token = localStorage.getItem("token");
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

showToast("Success", data.message, "success");

    }

    catch (error) {

        console.error(error);

        showToast("Error", "Something went wrong.", "error");

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

    showToast("Error", result.message || "Biometric registration failed.", "error");

    return;
}

showToast("Success", "Biometric enabled successfully.", "success");

            loadBiometricStatus();

        } catch (err) {

            console.error(err);

            showToast("Error", "Biometric registration cancelled.", "error");

        }

    });

}

const removeBiometricBtn =
    document.getElementById("removeBiometricBtn");

if (removeBiometricBtn) {

    removeBiometricBtn.addEventListener("click", async () => {

        const currentPassword = await requestPassword();

        if (!currentPassword) {

            return;

        }

        try {

            const token = localStorage.getItem("token");

            const response = await fetch(

                "/settings/security/biometric",

                {

                    method: "DELETE",

                    headers: {

                        "Content-Type": "application/json",

                        Authorization: `Bearer ${token}`

                    },

                    body: JSON.stringify({ currentPassword })

                }

            );

            const result = await response.json();

            if (!response.ok) {

                throw new Error(result.message);

            }

            showToast("Success", result.message, "success");

            loadBiometricStatus();

        }

        catch (error) {

            console.error(error);

            showToast("Error", error.message || "Unable to remove biometric.", "error");

        }

    });

}