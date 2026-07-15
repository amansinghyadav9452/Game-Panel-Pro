const toast = document.getElementById("toast");

const toastTitle = document.getElementById("toastTitle");

const toastMessage = document.getElementById("toastMessage");

const toastIcon = document.getElementById("toastIcon");

const toastClose = document.getElementById("toastClose");

let toastTimer;

function showToast(title, message, type = "success") {

    if (!toast) return;

    clearTimeout(toastTimer);

    toast.className = "toast";

    toast.classList.add(type);

    toast.classList.add("show");

    toastTitle.textContent = title;

    toastMessage.textContent = message;

    switch (type) {

        case "success":

            toastIcon.className =
                "fa-solid fa-circle-check";

            break;

        case "error":

            toastIcon.className =
                "fa-solid fa-circle-xmark";

            break;

        case "warning":

            toastIcon.className =
                "fa-solid fa-triangle-exclamation";

            break;

        case "info":

            toastIcon.className =
                "fa-solid fa-circle-info";

            break;

    }

    toastTimer = setTimeout(() => {

        toast.classList.remove("show");

    }, 3000);

}

if (toastClose) {

    toastClose.addEventListener("click", () => {

        toast.classList.remove("show");

        clearTimeout(toastTimer);

    });

}