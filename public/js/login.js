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

    pendingUsername = username.value.trim();

    if (typeof openOtpVerifyModal === "function") {

        openOtpVerifyModal(pendingUsername);

    } else {

        showMessage("Could not show verification screen. Please refresh and try again.", false);

    }

    loginBtn.disabled = false;

    loginBtn.innerHTML =
        `<i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In`;

    showMessage("Verification code sent to your email.", true);

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

    if (typeof gpHaptic === "function") {

        gpHaptic(success ? 15 : [20, 40, 20]);

    }

    if (!success) {

        const card = document.querySelector(".login-card");

        if (card) {

            card.classList.remove("gp-shake");

            void card.offsetWidth;

            card.classList.add("gp-shake");

        }

    }

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
   Reset Password (3-step)
-------------------------- */

const openResetPasswordBtn = document.getElementById("openResetPasswordBtn");

const resetUsernameOverlay = document.getElementById("resetUsernameOverlay");
const resetUsernameInput = document.getElementById("resetUsername");
const resetUsernameOk = document.getElementById("resetUsernameOk");
const resetUsernameCancel = document.getElementById("resetUsernameCancel");

const resetOtpOverlay = document.getElementById("resetOtpOverlay");
const resetOtpInput = document.getElementById("resetOtp");
const resetOtpOk = document.getElementById("resetOtpOk");
const resetOtpCancel = document.getElementById("resetOtpCancel");

const resetNewPasswordOverlay = document.getElementById("resetNewPasswordOverlay");
const resetNewPasswordInput = document.getElementById("resetNewPassword");
const resetConfirmPasswordInput = document.getElementById("resetConfirmPassword");
const resetNewPasswordOk = document.getElementById("resetNewPasswordOk");
const resetNewPasswordCancel = document.getElementById("resetNewPasswordCancel");

let resetUsername = "";
let resetOtpValue = "";

function closeAllResetModals() {

    resetUsernameOverlay.classList.remove("show");
    resetOtpOverlay.classList.remove("show");
    resetNewPasswordOverlay.classList.remove("show");

    resetUsernameInput.value = "";
    resetOtpInput.value = "";
    resetNewPasswordInput.value = "";
    resetConfirmPasswordInput.value = "";

    resetUsername = "";
    resetOtpValue = "";

}

if (openResetPasswordBtn) {

    openResetPasswordBtn.addEventListener("click", (e) => {

        e.preventDefault();

        resetUsernameOverlay.classList.add("show");

    });

}

if (resetUsernameCancel) {

    resetUsernameCancel.addEventListener("click", closeAllResetModals);

}

if (resetOtpCancel) {

    resetOtpCancel.addEventListener("click", closeAllResetModals);

}

if (resetNewPasswordCancel) {

    resetNewPasswordCancel.addEventListener("click", closeAllResetModals);

}

if (resetUsernameOk) {

    resetUsernameOk.addEventListener("click", async () => {

        const username = resetUsernameInput.value.trim();

        if (!username) {

            showMessage("Enter your username.", false);

            return;

        }

        resetUsernameOk.disabled = true;

        resetUsernameOk.textContent = "Sending...";

        try {

            const response = await fetch(

                "/login/reset-password/send-otp",

                {

                    method: "POST",

                    headers: {

                        "Content-Type": "application/json"

                    },

                    body: JSON.stringify({ username })

                }

            );

            const data = await response.json();

            resetUsernameOk.disabled = false;

            resetUsernameOk.textContent = "OK";

            if (data.success) {

                resetUsername = username;

                resetUsernameOverlay.classList.remove("show");

                resetOtpOverlay.classList.add("show");

            } else {

                showMessage(data.message, false);

            }

        }

        catch (err) {

            resetUsernameOk.disabled = false;

            resetUsernameOk.textContent = "OK";

            showMessage("Server Connection Failed", false);

        }

    });

}

if (resetOtpOk) {

    resetOtpOk.addEventListener("click", async () => {

        const otp = resetOtpInput.value.trim();

        if (!otp) {

            showMessage("Enter the OTP.", false);

            return;

        }

        resetOtpOk.disabled = true;

        resetOtpOk.textContent = "Verifying...";

        try {

            const response = await fetch(

                "/login/reset-password/verify-otp",

                {

                    method: "POST",

                    headers: {

                        "Content-Type": "application/json"

                    },

                    body: JSON.stringify({

                        username: resetUsername,

                        otp

                    })

                }

            );

            const data = await response.json();

            resetOtpOk.disabled = false;

            resetOtpOk.textContent = "OK";

            if (data.success) {

                resetOtpValue = otp;

                resetOtpOverlay.classList.remove("show");

                resetNewPasswordOverlay.classList.add("show");

            } else {

                showMessage(data.message, false);

            }

        }

        catch (err) {

            resetOtpOk.disabled = false;

            resetOtpOk.textContent = "OK";

            showMessage("Server Connection Failed", false);

        }

    });

}

if (resetNewPasswordOk) {

    resetNewPasswordOk.addEventListener("click", async () => {

        const newPassword = resetNewPasswordInput.value;

        const confirmPassword = resetConfirmPasswordInput.value;

        if (!newPassword || !confirmPassword) {

            showMessage("Fill both password fields.", false);

            return;

        }

        resetNewPasswordOk.disabled = true;

        resetNewPasswordOk.textContent = "Saving...";

        try {

            const response = await fetch(

                "/login/reset-password/reset",

                {

                    method: "POST",

                    headers: {

                        "Content-Type": "application/json"

                    },

                    body: JSON.stringify({

                        username: resetUsername,

                        otp: resetOtpValue,

                        newPassword,

                        confirmPassword

                    })

                }

            );

            const data = await response.json();

            resetNewPasswordOk.disabled = false;

            resetNewPasswordOk.textContent = "OK";

            if (data.success) {

                closeAllResetModals();

                window.location.href = "/login";

            } else {

                showMessage(data.message, false);

            }

        }

        catch (err) {

            resetNewPasswordOk.disabled = false;

            resetNewPasswordOk.textContent = "OK";

            showMessage("Server Connection Failed", false);

        }

    });

}

/* -------------------------
   Login Page - Random Theme Color
   (applies automatically on every page load, and again on click)

   Sets a handful of CSS custom properties (background gradient,
   floating glow circles, shield glow) on <html> so the entire
   page repaints in a new color — not just a CSS filter, which
   has no visible effect on near-black/grayscale pixels.
-------------------------- */

// Evenly spaced hues around the color wheel (24 colors) + one
// "null" entry that restores the original monochrome black
// look. 25 distinct themes in total.
const PANEL_THEME_HUES = [
    0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165,
    180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345,
    null
];

function applyRandomTheme() {

    const stored = localStorage.getItem("panelThemeHue");
    const lastHue = stored === null ? undefined : (stored === "null" ? null : Number(stored));

    let hue;

    do {

        hue = PANEL_THEME_HUES[Math.floor(Math.random() * PANEL_THEME_HUES.length)];

    } while (PANEL_THEME_HUES.length > 1 && hue === lastHue);

    const root = document.documentElement.style;

    if (hue === null) {

        // Original all-black theme
        root.setProperty("--theme-bg-a", "#030303");
        root.setProperty("--theme-bg-b", "#050505");
        root.setProperty("--theme-bg-c", "#000000");

        root.setProperty("--theme-glow1", "#1f1f1f");
        root.setProperty("--theme-glow2", "#262626");

        root.setProperty("--theme-circle1", "#3a3a3a");
        root.setProperty("--theme-circle2", "#2e2e2e");
        root.setProperty("--theme-circle3", "#333333");

        root.setProperty("--theme-glow-shadow", "rgba(255,255,255,.45)");
        root.setProperty("--theme-glow-shadow-soft", "rgba(255,255,255,.40)");
        root.setProperty("--theme-glow-a", "rgba(255,255,255,.35)");
        root.setProperty("--theme-glow-b", "rgba(255,255,255,.55)");

    } else {

        const h2 = (hue + 25) % 360;
        const h3 = (hue - 25 + 360) % 360;

        root.setProperty("--theme-bg-a", `hsl(${hue} 45% 4%)`);
        root.setProperty("--theme-bg-b", `hsl(${h3} 40% 3%)`);
        root.setProperty("--theme-bg-c", "#000000");

        root.setProperty("--theme-glow1", `hsl(${hue} 60% 16%)`);
        root.setProperty("--theme-glow2", `hsl(${h2} 55% 17%)`);

        root.setProperty("--theme-circle1", `hsl(${hue} 65% 24%)`);
        root.setProperty("--theme-circle2", `hsl(${h2} 60% 20%)`);
        root.setProperty("--theme-circle3", `hsl(${h3} 62% 22%)`);

        root.setProperty("--theme-glow-shadow", `hsla(${hue}, 85%, 60%, .45)`);
        root.setProperty("--theme-glow-shadow-soft", `hsla(${hue}, 85%, 60%, .40)`);
        root.setProperty("--theme-glow-a", `hsla(${hue}, 85%, 60%, .35)`);
        root.setProperty("--theme-glow-b", `hsla(${hue}, 85%, 65%, .55)`);

    }

    localStorage.setItem("panelThemeHue", hue === null ? "null" : hue);

}

// Auto-apply a fresh random color every time the login page loads
applyRandomTheme();

const logoBox = document.querySelector(".logo-box");

if (logoBox) {

    logoBox.style.cursor = "pointer";

    logoBox.addEventListener("click", () => {

        applyRandomTheme();

        logoBox.classList.remove("shield-clicked");

        void logoBox.offsetWidth;

        logoBox.classList.add("shield-clicked");

    });

}
