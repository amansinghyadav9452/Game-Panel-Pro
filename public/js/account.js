
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

            const response = await fetch("/settings/account", {

                method: "PUT",

                headers: {

                    "Content-Type": "application/json"

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

            const response = await fetch(

                "/account/password",

                {

                    method: "PUT",

                    headers: {

                        "Content-Type": "application/json"

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

            }

        }

        catch (error) {

            console.error(error);

            alert("Something went wrong.");

        }

    });

}