(function () {

    const openBtn = document.getElementById("openCustomerAccessBtn");
    const overlay = document.getElementById("customerAccessOverlay");

    if (!openBtn || !overlay) return;

    const step1 = document.getElementById("custSignupStep1");
    const step2 = document.getElementById("custSignupStep2");
    const codeInput = document.getElementById("custReferralCode");
    const codeError = document.getElementById("custCodeError");
    const signupError = document.getElementById("custSignupError");
    let verifiedCode = null;

    function showStep(step) {
        step1.hidden = step !== step1;
        step2.hidden = step !== step2;
    }

    function resetModal() {
        showStep(step1);
        verifiedCode = null;
        codeInput.value = "";
        codeError.textContent = "";
        signupError.textContent = "";
        document.getElementById("custNewUsername").value = "";
        document.getElementById("custNewPassword").value = "";
        document.getElementById("custCodeValidUntil").textContent = "Referral verified";
    }

    function closeModal() {
        overlay.classList.remove("show");
        resetModal();
    }

    openBtn.addEventListener("click", (e) => {
        e.preventDefault();
        resetModal();
        overlay.classList.add("show");
        setTimeout(() => codeInput.focus(), 80);
    });

    document.getElementById("customerAccessCancel")?.addEventListener("click", closeModal);

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay.classList.contains("show")) closeModal();
    });

    document.getElementById("custVerifyCodeBtn")?.addEventListener("click", async () => {
        const code = codeInput.value.trim().toUpperCase();
        codeError.textContent = "";

        if (!/^REF-[A-Z0-9]{10}$/.test(code)) {
            codeError.textContent = "Enter a valid referral code.";
            return;
        }

        const btn = document.getElementById("custVerifyCodeBtn");
        btn.disabled = true;
        btn.textContent = "Checking...";

        try {
            const res = await fetch(`/customer/referral/${encodeURIComponent(code)}/check`, {
                headers: { "Accept": "application/json" }
            });
            const data = await res.json();

            if (!data.success) {
                codeError.textContent = data.message || "Invalid referral code.";
                return;
            }

            verifiedCode = code;
            document.getElementById("custCodeValidUntil").textContent =
                `Verified • access valid until ${new Date(data.expiryAt).toLocaleDateString()}`;
            showStep(step2);
            setTimeout(() => document.getElementById("custNewUsername").focus(), 50);

        } catch (err) {
            console.error(err);
            codeError.textContent = "Server connection failed.";
        } finally {
            btn.disabled = false;
            btn.textContent = "Verify Code";
        }
    });

    document.getElementById("custSignupBack")?.addEventListener("click", () => {
        signupError.textContent = "";
        showStep(step1);
        codeInput.focus();
    });

    document.getElementById("custSignupBtn")?.addEventListener("click", async () => {
        const username = document.getElementById("custNewUsername").value.trim();
        const password = document.getElementById("custNewPassword").value;
        signupError.textContent = "";

        if (!verifiedCode) {
            showStep(step1);
            return;
        }

        if (username.length < 3 || username.length > 40 || password.length < 6 || password.length > 128) {
            signupError.textContent = "Username must be 3-40 chars; password 6-128 chars.";
            return;
        }

        const btn = document.getElementById("custSignupBtn");
        btn.disabled = true;
        btn.textContent = "Creating...";

        try {
            const res = await fetch("/customer/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({
                    referralCode: verifiedCode,
                    username,
                    password,
                    turnstileToken: document.querySelector("[name='cf-turnstile-response']")?.value || undefined
                })
            });

            const data = await res.json();

            if (!data.success) {
                signupError.textContent = data.message || "Signup failed.";
                return;
            }

            // Signup does NOT create a customer session. The normal login form
            // is the only login entry point now.
            closeModal();
            document.getElementById("username").value = data.username || username;
            document.getElementById("password").value = "";
            showMessage(data.message || "Account created. Please sign in.", true);
            document.getElementById("password").focus();

        } catch (err) {
            console.error(err);
            signupError.textContent = "Server connection failed.";
        } finally {
            btn.disabled = false;
            btn.textContent = "Create Account";
        }
    });

})();
