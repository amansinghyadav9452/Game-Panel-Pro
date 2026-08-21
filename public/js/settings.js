if (!localStorage.getItem("token") && !localStorage.getItem("customerToken")) {

    window.location.replace("/login");

}

if ((typeof getPanelRole === "function" ? getPanelRole() : null) === "customer") {

    if (typeof showToast === "function") {
        showToast("Restricted", "Sorry, it's allowed only to the admin.", "error");
    }

    setTimeout(() => window.location.replace("/panel"), 900);

}

document.addEventListener("DOMContentLoaded", () => {

    initSidebar();
    initAutoLogout();

    if ((typeof getPanelRole === "function" ? getPanelRole() : null) === "customer") {
        return;
    }

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

