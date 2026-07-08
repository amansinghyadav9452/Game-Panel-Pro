const form = document.getElementById("loginForm");

const username = document.getElementById("username");

const password = document.getElementById("password");

const loginBtn = document.getElementById("loginBtn");

const togglePassword = document.getElementById("togglePassword");

const message = document.getElementById("message");

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

                password: password.value

            })

        });

        const data = await response.json();

        if (data.success) {

            localStorage.setItem("token", data.token);

            loginBtn.innerHTML =
                `<i class="fa-solid fa-check"></i> Success`;

            setTimeout(() => {

                window.location.href = "/dashboard";

            }, 700);

        } else {

            showMessage(data.message, false);

        }

    } catch (err) {

        showMessage("Server Connection Failed", false);

    }

    loginBtn.disabled = false;

    loginBtn.innerHTML =
        `<i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In`;

});

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