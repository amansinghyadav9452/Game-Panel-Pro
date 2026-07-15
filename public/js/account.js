
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

            const response = await fetch("/account", {

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