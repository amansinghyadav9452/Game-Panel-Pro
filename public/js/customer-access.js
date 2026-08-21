(function () {

    const openBtn = document.getElementById("openCustomerAccessBtn");
    const overlay = document.getElementById("customerAccessOverlay");

    if (!openBtn || !overlay) return;

    const tabLogin = document.getElementById("custTabLogin");
    const tabSignup = document.getElementById("custTabSignup");

    const loginPane = document.getElementById("custLoginPane");
    const step1 = document.getElementById("custSignupStep1");
    const step2 = document.getElementById("custSignupStep2");

    let verifiedCode = null;

    function showOnly(pane) {

        [loginPane, step1, step2].forEach((el) => {
            el.style.display = el === pane ? "block" : "none";
        });

    }

    function resetModal() {

        showOnly(loginPane);

        tabLogin.classList.add("active");
        tabSignup.classList.remove("active");

        document.getElementById("custLoginUsername").value = "";
        document.getElementById("custLoginPassword").value = "";
        document.getElementById("custLoginError").textContent = "";

        document.getElementById("custReferralCode").value = "";
        document.getElementById("custCodeError").textContent = "";

        document.getElementById("custNewUsername").value = "";
        document.getElementById("custNewPassword").value = "";
        document.getElementById("custSignupError").textContent = "";

        verifiedCode = null;

    }

    openBtn.addEventListener("click", (e) => {
        e.preventDefault();
        resetModal();
        overlay.classList.add("show");
    });

    function closeModal() {
        overlay.classList.remove("show");
    }

    document.getElementById("customerAccessCancel").addEventListener("click", closeModal);
    document.getElementById("customerAccessCancel2").addEventListener("click", closeModal);

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
    });

    tabLogin.addEventListener("click", () => {
        tabLogin.classList.add("active");
        tabSignup.classList.remove("active");
        showOnly(loginPane);
    });

    tabSignup.addEventListener("click", () => {
        tabSignup.classList.add("active");
        tabLogin.classList.remove("active");
        showOnly(step1);
    });

    // ===== Login =====

    document.getElementById("custLoginBtn").addEventListener("click", async () => {

        const username = document.getElementById("custLoginUsername").value.trim();
        const password = document.getElementById("custLoginPassword").value;
        const errorEl = document.getElementById("custLoginError");

        errorEl.textContent = "";

        if (!username || !password) {
            errorEl.textContent = "Enter username and password.";
            return;
        }

        try {

            const res = await fetch("/customer/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (!data.success) {
                errorEl.textContent = data.message || "Login failed.";
                return;
            }

            localStorage.setItem("customerToken", data.token);

            window.location.href = "/panel";

        }

        catch (err) {

            errorEl.textContent = "Network error. Try again.";

        }

    });

    // ===== Signup step 1: verify code =====

    document.getElementById("custVerifyCodeBtn").addEventListener("click", async () => {

        const code = document.getElementById("custReferralCode").value.trim().toUpperCase();
        const errorEl = document.getElementById("custCodeError");

        errorEl.textContent = "";

        if (!code) {
            errorEl.textContent = "Enter a referral code.";
            return;
        }

        try {

            const res = await fetch(`/customer/referral/${encodeURIComponent(code)}/check`);

            const data = await res.json();

            if (!data.success) {
                errorEl.textContent = data.message || "Invalid code.";
                return;
            }

            verifiedCode = code;

            const until = new Date(data.expiryAt).toLocaleDateString();

            document.getElementById("custCodeValidUntil").textContent =
                `Access valid until ${until}`;

            showOnly(step2);

        }

        catch (err) {

            errorEl.textContent = "Network error. Try again.";

        }

    });

    document.getElementById("custSignupBack").addEventListener("click", () => {
        showOnly(step1);
    });

    // ===== Signup step 2: create account =====

    document.getElementById("custSignupBtn").addEventListener("click", async () => {

        const username = document.getElementById("custNewUsername").value.trim();
        const password = document.getElementById("custNewPassword").value;
        const errorEl = document.getElementById("custSignupError");

        errorEl.textContent = "";

        if (!verifiedCode) {
            showOnly(step1);
            return;
        }

        if (username.length < 3 || password.length < 6) {
            errorEl.textContent = "Username 3+ chars, password 6+ chars.";
            return;
        }

        try {

            const res = await fetch("/customer/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    referralCode: verifiedCode,
                    username,
                    password
                })
            });

            const data = await res.json();

            if (!data.success) {
                errorEl.textContent = data.message || "Signup failed.";
                return;
            }

            localStorage.setItem("customerToken", data.token);

            window.location.href = "/panel";

        }

        catch (err) {

            errorEl.textContent = "Network error. Try again.";

        }

    });

})();
