if (!localStorage.getItem("token")) {

    window.location.replace("/login");

}
document.addEventListener("DOMContentLoaded", () => {

    initSidebar();

    const searchInput =
        document.querySelector(".settings-search input");

const cards = document.querySelectorAll(".setting-item");

    const empty =
        document.querySelector(".empty-search");

    if (searchInput) {

        searchInput.focus();

    } 

    document.addEventListener("keydown", (e) => {

        if (e.ctrlKey && e.key.toLowerCase() === "k") {

            e.preventDefault();

            searchInput?.focus();

        }

    });

    if (searchInput) {

        searchInput.addEventListener("input", function () {

            const value =
                this.value.toLowerCase().trim();

            let visible = 0;

cards.forEach(card => {

    const text = card.textContent.toLowerCase();

    const show = text.includes(value);

    console.log(card.textContent, show);

    card.style.display = show ? "" : "none";

    if (show) visible++;

});

            if (empty) {

                empty.style.display =
                    visible ? "none" : "flex";

            }

        });

    }

});

const profileInput = document.getElementById("profileInput");
const changeProfileBtn = document.getElementById("changeProfileBtn");

if (changeProfileBtn && profileInput) {

    changeProfileBtn.addEventListener("click", () => {

        profileInput.click();

    });

    profileInput.addEventListener("change", async () => {

        if (!profileInput.files.length) return;

        const formData = new FormData();

        formData.append("profile", profileInput.files[0]);

        const token = localStorage.getItem("token");

        const response = await fetch("/settings/profile/upload", {

            method: "POST",

            headers: {

                Authorization: `Bearer ${token}`

            },

            body: formData

        });

        const data = await response.json();

        if (data.success) {

            showToast("Profile photo updated successfully.");

            location.reload();

        } else {

            showToast(data.message || "Upload failed.", "error");

        }

    });

}