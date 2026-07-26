if (!localStorage.getItem("token")) {

    window.location.replace("/login");

}

async function loadAccountDetails() {

    const usernameInput = document.getElementById("username");

    if (!usernameInput) return;

    const token = localStorage.getItem("token");

    try {

        const response = await fetch("/settings/account/me", {

            headers: {

                Authorization: `Bearer ${token}`

            }

        });

        const data = await response.json();

        if (data.success) {

            usernameInput.value = data.admin.username;

            const emailInput = document.getElementById("email");

            if (emailInput) {

                emailInput.value = data.admin.email || "";

            }

        }

    }

    catch (error) {

        console.error(error);

    }

}

loadAccountDetails();

async function load2faStatus() {

    const badge = document.getElementById("twoFaBadge");

    const enableBtn = document.getElementById("enable2faBtn");

    const disableBtn = document.getElementById("disable2faBtn");

    const emailInput = document.getElementById("email");

    if (!badge) return;

    const token = localStorage.getItem("token");

    try {

        const response = await fetch("/settings/account/2fa/status", {

            headers: {

                Authorization: `Bearer ${token}`

            }

        });

        const data = await response.json();

        if (!data.success) return;

        if (data.enabled) {

            badge.textContent = "Enabled";

            badge.classList.remove("warning");

            badge.classList.add("active");

            if (enableBtn) enableBtn.style.display = "none";

            if (disableBtn) disableBtn.style.display = "flex";

            if (emailInput) emailInput.disabled = true;

        }

        else {

            badge.textContent = "Disabled";

            badge.classList.remove("active");

            badge.classList.add("warning");

            if (enableBtn) enableBtn.style.display = "flex";

            if (disableBtn) disableBtn.style.display = "none";

            if (emailInput) emailInput.disabled = false;

        }

    }

    catch (error) {

        console.error(error);

    }

}

load2faStatus();

const enable2faBtn = document.getElementById("enable2faBtn");

if (enable2faBtn) {

    enable2faBtn.addEventListener("click", async () => {

        const email = document.getElementById("email").value.trim();

        if (!email) {

            showToast("Error", "Enter an email first.", "error");

            return;

        }

        const token = localStorage.getItem("token");

        try {

            const sendResponse = await fetch(

                "/settings/account/2fa/send-otp",

                {

                    method: "POST",

                    headers: {

                        "Content-Type": "application/json",

                        Authorization: `Bearer ${token}`

                    },

                    body: JSON.stringify({ email })

                }

            );

            const sendData = await sendResponse.json();

            if (!sendResponse.ok) {

                throw new Error(sendData.message);

            }

            showToast("Success", sendData.message, "success");

            const otp = await requestOtp();

            if (!otp) return;

            const verifyResponse = await fetch(

                "/settings/account/2fa/verify",

                {

                    method: "POST",

                    headers: {

                        "Content-Type": "application/json",

                        Authorization: `Bearer ${token}`

                    },

                    body: JSON.stringify({ otp })

                }

            );

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok) {

                throw new Error(verifyData.message);

            }

            showToast("Success", verifyData.message, "success");

            load2faStatus();

        }

        catch (error) {

            console.error(error);

            showToast(

                "Error",

                error.message || "Something went wrong.",

                "error"

            );

        }

    });

}

const disable2faBtn = document.getElementById("disable2faBtn");

if (disable2faBtn) {

    disable2faBtn.addEventListener("click", async () => {

        const currentPassword = await requestPassword();

        if (!currentPassword) return;

        const token = localStorage.getItem("token");

        try {

            const response = await fetch(

                "/settings/account/2fa/disable",

                {

                    method: "POST",

                    headers: {

                        "Content-Type": "application/json",

                        Authorization: `Bearer ${token}`

                    },

                    body: JSON.stringify({ currentPassword })

                }

            );

            const data = await response.json();

            if (!response.ok) {

                throw new Error(data.message);

            }

            showToast("Success", data.message, "success");

            load2faStatus();

        }

        catch (error) {

            console.error(error);

            showToast(

                "Error",

                error.message || "Something went wrong.",

                "error"

            );

        }

    });

}

const saveBtn = document.getElementById("saveAccountBtn");

if (saveBtn) {

    saveBtn.addEventListener("click", async () => {

        const username = document
            .getElementById("username")
            .value
            .trim();

        if (!username) {

            alert("Username is required.");

            return;

        }

        try {

            const token = localStorage.getItem("token");

            const response = await fetch("/settings/account", {

                method: "PUT",

                headers: {

                    "Content-Type": "application/json",

                    Authorization: `Bearer ${token}`

                },

                body: JSON.stringify({

                    username

                })

            });

            const data = await response.json();

            if (data.success) {

                alert(data.message);

            }

            else {

                alert(data.message);

            }

        }

        catch (error) {

            console.error(error);

            alert("Something went wrong.");

        }

    });

}

const logoutAllBtn = document.getElementById("logoutAllBtn");

if (logoutAllBtn) {

    logoutAllBtn.addEventListener("click", () => {

        showConfirm(

            "Logout All Devices",

            "This will sign you out on this device and every other device. Continue?",

            async () => {

                const token = localStorage.getItem("token");

                try {

                    const response = await fetch(

                        "/settings/account/logout-all",

                        {

                            method: "POST",

                            headers: {

                                Authorization: `Bearer ${token}`

                            }

                        }

                    );

                    const data = await response.json();

                    if (data.success) {

                        localStorage.removeItem("token");

                        localStorage.removeItem("logoutAt");

                        window.location.replace("/login");

                    }

                    else {

                        alert(data.message || "Something went wrong.");

                    }

                }

                catch (error) {

                    console.error(error);

                    alert("Something went wrong.");

                }

            }

        );

    });

}

/* ==========================
   CHANGE PASSWORD MODAL
========================== */

const passwordModal = document.getElementById("passwordModal");

const changePasswordBtn = document.getElementById("changePasswordBtn");

const closePasswordModal = document.getElementById("closePasswordModal");

const cancelPassword = document.getElementById("cancelPassword");

if (changePasswordBtn) {

    changePasswordBtn.addEventListener("click", () => {

        passwordModal.classList.add("show");

    });

}

if (closePasswordModal) {

    closePasswordModal.addEventListener("click", () => {

        passwordModal.classList.remove("show");

    });

}

if (cancelPassword) {

    cancelPassword.addEventListener("click", () => {

        passwordModal.classList.remove("show");

    });

}

window.addEventListener("click", (e) => {

    if (e.target === passwordModal) {

        passwordModal.classList.remove("show");

    }

});

const savePassword = document.getElementById("savePassword");

if (savePassword) {

    savePassword.addEventListener("click", async () => {

        const currentPassword = document
            .getElementById("currentPassword")
            .value;

        const newPassword = document
            .getElementById("newPassword")
            .value;

        const confirmPassword = document
            .getElementById("confirmPassword")
            .value;

        try {

            const token = localStorage.getItem("token");

            const response = await fetch(

                "/settings/account/password",

                {

                    method: "PUT",

                    headers: {

                        "Content-Type": "application/json",

                        Authorization: `Bearer ${token}`

                    },

                    body: JSON.stringify({

                        currentPassword,

                        newPassword,

                        confirmPassword

                    })

                }

            );

            const data = await response.json();

            alert(data.message);

            if (data.success) {

                passwordModal.classList.remove("show");

                document.getElementById("currentPassword").value = "";

                document.getElementById("newPassword").value = "";

                document.getElementById("confirmPassword").value = "";

                localStorage.removeItem("token");

                localStorage.removeItem("logoutAt");

                window.location.replace("/login");

            }

        }

        catch (error) {

            console.error(error);

            alert("Something went wrong.");

        }

    });

}