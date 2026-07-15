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

    try {

        const response = await fetch("/security", {

            method: "PUT",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

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