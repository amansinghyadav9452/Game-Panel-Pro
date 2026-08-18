let otpPendingUsername = "";
let otpResendCooldownTimer = null;

function openOtpVerifyModal(username) {

    otpPendingUsername = username;

    const overlay = document.getElementById("otpVerifyOverlay");
    const input = document.getElementById("otpVerifyInput");
    const msg = document.getElementById("otpVerifyMessage");

    if (!overlay || !input) return;

    input.value = "";
    msg.textContent = "";
    msg.className = "otp-verify-message";

    const confirmBtn = document.getElementById("otpVerifyConfirm");
    if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<i class="fa-solid fa-check"></i> Verify Code`;
    }

    overlay.classList.add("show");

    setTimeout(() => input.focus(), 150);

}

function closeOtpVerifyModal() {

    const overlay = document.getElementById("otpVerifyOverlay");

    if (overlay) {
        overlay.classList.remove("show");
    }

    otpPendingUsername = "";

    if (otpResendCooldownTimer) {
        clearInterval(otpResendCooldownTimer);
        otpResendCooldownTimer = null;
    }

}

function setOtpMessage(text, type) {

    const msg = document.getElementById("otpVerifyMessage");

    if (!msg) return;

    msg.textContent = text || "";
    msg.className = "otp-verify-message" + (type ? ` ${type}` : "");

}

document.addEventListener("DOMContentLoaded", () => {

    const overlay = document.getElementById("otpVerifyOverlay");
    const input = document.getElementById("otpVerifyInput");
    const confirmBtn = document.getElementById("otpVerifyConfirm");
    const cancelBtn = document.getElementById("otpVerifyCancel");
    const resendLink = document.getElementById("otpVerifyResend");

    if (!overlay) return;

    if (cancelBtn) {

        cancelBtn.addEventListener("click", () => {

            closeOtpVerifyModal();

            const password = document.getElementById("password");
            if (password) password.value = "";

            const loginMessage = document.getElementById("message");
            if (loginMessage) loginMessage.innerHTML = "";

        });

    }

    async function verifyOtp() {

        const otp = input.value.trim();

        if (!otp || otp.length !== 6) {

            setOtpMessage("Enter the 6-digit verification code.", "error");
            return;

        }

        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verifying...`;
        setOtpMessage("", "");

        try {

            const response = await fetch("/login/2fa/verify", {

                method: "POST",

                headers: { "Content-Type": "application/json" },

                body: JSON.stringify({

                    username: otpPendingUsername,

                    otp,

                    deviceId: getDeviceId()

                })

            });

            const data = await response.json();

            if (data.success) {

                setOtpMessage("Verified! Redirecting...", "success");

                localStorage.setItem("token", data.token);

                localStorage.setItem(
                    "logoutAt",
                    Date.now() + 15 * 60 * 1000
                );

                confirmBtn.innerHTML = `<i class="fa-solid fa-check"></i> Success`;

                // Developer role ab admin jaisa full panel access rakhta hai.
                const destination = "/panel";

                setTimeout(() => {
                    window.location.href = destination;
                }, 600);

                return;

            }

            if (response.status === 429) {

                setOtpMessage(
                    data.message || "Too many incorrect attempts. Please login again.",
                    "error"
                );

                setTimeout(() => {

                    closeOtpVerifyModal();

                    const password = document.getElementById("password");
                    if (password) password.value = "";

                }, 1800);

                return;

            }

            const remaining =
                typeof data.attemptsRemaining === "number"
                    ? ` (${data.attemptsRemaining} attempt${data.attemptsRemaining === 1 ? "" : "s"} left)`
                    : "";

            setOtpMessage((data.message || "Invalid verification code.") + remaining, "error");

            input.value = "";
            input.focus();

        } catch (err) {

            setOtpMessage("Server connection failed.", "error");

        } finally {

            confirmBtn.disabled = false;

            if (confirmBtn.innerHTML.includes("Success") === false) {
                confirmBtn.innerHTML = `<i class="fa-solid fa-check"></i> Verify Code`;
            }

        }

    }

    if (confirmBtn) {
        confirmBtn.addEventListener("click", verifyOtp);
    }

    if (input) {

        input.addEventListener("input", () => {
            input.value = input.value.replace(/\D/g, "");
        });

        input.addEventListener("keydown", (e) => {

            if (e.key === "Enter") {
                e.preventDefault();
                verifyOtp();
            }

        });

    }

    if (resendLink) {

        resendLink.addEventListener("click", async (e) => {

            e.preventDefault();

            if (resendLink.classList.contains("disabled")) return;

            try {

                const response = await fetch("/login/2fa/resend", {

                    method: "POST",

                    headers: { "Content-Type": "application/json" },

                    body: JSON.stringify({ username: otpPendingUsername })

                });

                const data = await response.json();

                setOtpMessage(
                    data.message || "A new code has been sent if applicable.",
                    data.success ? "success" : "error"
                );

                let seconds = 30;

                resendLink.classList.add("disabled");

                const originalText = "Resend code";

                otpResendCooldownTimer = setInterval(() => {

                    resendLink.textContent = `Resend code (${seconds}s)`;

                    seconds--;

                    if (seconds < 0) {

                        clearInterval(otpResendCooldownTimer);
                        otpResendCooldownTimer = null;

                        resendLink.classList.remove("disabled");
                        resendLink.textContent = originalText;

                    }

                }, 1000);

            } catch (err) {

                setOtpMessage("Server connection failed.", "error");

            }

        });

    }

});
