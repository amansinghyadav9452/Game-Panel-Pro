const form = document.getElementById("loginForm");

const username = document.getElementById("username");

const password = document.getElementById("password");

const loginBtn = document.getElementById("loginBtn");

const togglePassword = document.getElementById("togglePassword");

const message = document.getElementById("message");

let pendingUsername = "";

/* -------------------------
   Show / Hide Password
-------------------------- */

togglePassword.addEventListener("click", () => {

    const icon = togglePassword.querySelector("i");

    if (password.type === "password") {

        password.type = "text";

        icon.classList.remove("fa-eye");

        icon.classList.add("fa-eye-slash");

    } else {

        password.type = "password";

        icon.classList.remove("fa-eye-slash");

        icon.classList.add("fa-eye");

    }

});

/* -------------------------
   Login
-------------------------- */

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    let data;

    loginBtn.disabled = true;

    loginBtn.innerHTML =
        `<i class="fa-solid fa-spinner fa-spin"></i> Signing In...`;

    message.innerHTML = "";
    

    try {

        const response = await fetch("/login", {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

body: JSON.stringify({

    username: username.value.trim(),

    password: password.value,

    turnstileToken:
    document.querySelector(
        "[name='cf-turnstile-response']"
    )?.value

})

        });

        data = await response.json();

if (data.success && data.twoFactorRequired) {

    try {

        pendingUsername = username.value.trim();

        form.style.display = "none";

        const securityStatus = document.getElementById("securityStatus");

        if (securityStatus) securityStatus.style.display = "none";

        const otpStep = document.getElementById("otpStep");

        if (!otpStep) {

            throw new Error("otpStep element not found in DOM - login.ejs may not be updated.");

        }

        otpStep.style.display = "block";
        otpStep.style.visibility = "visible";
        otpStep.style.opacity = "1";

        const otpField = document.getElementById("otpInput");

        if (otpField) {

            otpField.value = "";

            setTimeout(() => otpField.focus(), 100);

        }

        loginBtn.disabled = false;

        loginBtn.innerHTML =
            `<i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In`;

        showMessage("Verification code sent to your email.", true);

    }

    catch (stepError) {

        console.error("2FA step error:", stepError);

        showMessage("Could not show verification screen: " + stepError.message, false);

    }

} else if (data.success) {

    localStorage.setItem("token", data.token);

    localStorage.setItem(
        "logoutAt",
        Date.now() + 15 * 60 * 1000
    );

    loginBtn.innerHTML =
        `<i class="fa-solid fa-check"></i> Success`;

    setTimeout(() => {

        window.location.href = "/panel";

    }, 700);

} else {

if (data.remaining) {

    showMessage(data.message, false);

    startLockCountdown(data.remaining);

} else {

    showMessage(data.message, false);

}

}

    } catch (err) {

        showMessage("Server Connection Failed", false);

    }

    
if (!data || !data.remaining) {

    loginBtn.disabled = false;

    loginBtn.innerHTML =
        `<i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In`;

}}
);

/* -------------------------
   Message
-------------------------- */

function showMessage(text, success) {

    message.innerHTML = text;

    message.style.marginTop = "18px";

    message.style.textAlign = "center";

    message.style.fontWeight = "500";

    message.style.color = success ? "#22C55E" : "#EF4444";

}

function startLockCountdown(seconds) {

    const loginBtn = document.getElementById("loginBtn");
    const error = document.getElementById("message");

    loginBtn.disabled = true;

    const timer = setInterval(() => {

        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;

loginBtn.innerHTML =
`<i class="fa-solid fa-lock"></i> Locked (${minutes}m ${secs}s)`;

        error.innerHTML =
            `Too many failed login attempts.`;

        seconds--;

        if (seconds < 0) {

            clearInterval(timer);

            loginBtn.disabled = false;

            loginBtn.innerHTML =
`<i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In`;

            error.innerHTML = "";

        }

    }, 1000);

}

const card =
document.querySelector(".login-card");

const light =
document.querySelector(".mouse-light");

card.addEventListener("mousemove",(e)=>{

    const rect =
    card.getBoundingClientRect();

    light.style.left =
    (e.clientX-rect.left)+"px";

    light.style.top =
    (e.clientY-rect.top)+"px";

});

card.addEventListener("mouseleave",()=>{

    light.style.left="50%";

    light.style.top="50%";

});

const biometricBtn =
    document.getElementById("fingerprintLogin");

if (biometricBtn) {

    biometricBtn.addEventListener("click", async () => {

        try {

            const username =
                document.getElementById("username").value.trim();

            if (!username) {

                showToast(
                    "Error",
                    "Enter username first.",
                    "error"
                );

                return;

            }

            const optionsResponse =
                await fetch(
                    "/api/webauthn/login/options",
                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            username
                        })

                    }
                );

            const options =
                await optionsResponse.json();

            const authenticationResponse =
                await SimpleWebAuthnBrowser.startAuthentication({

                    optionsJSON: options

                });

            const verifyResponse =
                await fetch(
                    "/api/webauthn/login/verify",
                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            username,

                            authenticationResponse

                        })

                    }
                );

            const result =
                await verifyResponse.json();

            if (!result.success) {

                showToast(

                    "Error",

                    result.message,

                    "error"

                );

                return;

            }

localStorage.setItem("token", result.token);

await new Promise(resolve => setTimeout(resolve, 100));

window.location.href = "/panel";

        }

        catch (err) {

            console.error(err);

            showToast(

                "Error",

                "Biometric authentication cancelled.",

                "error"

            );

        }

    });

}
/* -------------------------
   OTP Verification (2FA)
-------------------------- */

const verifyOtpBtn = document.getElementById("verifyOtpBtn");

const otpInput = document.getElementById("otpInput");

const resendOtpLink = document.getElementById("resendOtpLink");

if (verifyOtpBtn) {

    verifyOtpBtn.addEventListener("click", async () => {

        const otp = otpInput.value.trim();

        if (!otp) {

            showMessage("Enter the verification code.", false);

            return;

        }

        verifyOtpBtn.disabled = true;

        verifyOtpBtn.innerHTML =
            `<i class="fa-solid fa-spinner fa-spin"></i> Verifying...`;

        try {

            const response = await fetch("/login/2fa/verify", {

                method: "POST",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify({

                    username: pendingUsername,

                    otp

                })

            });

            const data = await response.json();

            if (data.success) {

                localStorage.setItem("token", data.token);

                localStorage.setItem(
                    "logoutAt",
                    Date.now() + 15 * 60 * 1000
                );

                verifyOtpBtn.innerHTML =
                    `<i class="fa-solid fa-check"></i> Success`;

                setTimeout(() => {

                    window.location.href = "/panel";

                }, 700);

            } else {

                showMessage(data.message, false);

                verifyOtpBtn.disabled = false;

                verifyOtpBtn.innerHTML =
                    `<i class="fa-solid fa-check"></i> Verify Code`;

            }

        }

        catch (err) {

            showMessage("Server Connection Failed", false);

            verifyOtpBtn.disabled = false;

            verifyOtpBtn.innerHTML =
                `<i class="fa-solid fa-check"></i> Verify Code`;

        }

    });

}

if (resendOtpLink) {

    resendOtpLink.addEventListener("click", async (e) => {

        e.preventDefault();

        try {

            const response = await fetch("/login/2fa/resend", {

                method: "POST",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify({

                    username: pendingUsername

                })

            });

            const data = await response.json();

            showMessage(

                data.message ||
                    "A new code has been sent if applicable.",

                data.success

            );

        }

        catch (err) {

            showMessage("Server Connection Failed", false);

        }

    });

}

const backToLoginLink = document.getElementById("backToLoginLink");

if (backToLoginLink) {

    backToLoginLink.addEventListener("click", (e) => {

        e.preventDefault();

        pendingUsername = "";

        document.getElementById("otpStep").style.display = "none";

        const securityStatus = document.getElementById("securityStatus");

        if (securityStatus) securityStatus.style.display = "flex";

        form.style.display = "block";

        password.value = "";

        message.innerHTML = "";

    });

}
