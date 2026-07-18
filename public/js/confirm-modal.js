let confirmCallback = null;

function showConfirm(title, message, callback) {

    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmMessage").textContent = message;

    document.getElementById("confirmOverlay")
        .classList.add("show");

    confirmCallback = callback;
}

const confirmCancel =
    document.getElementById("confirmCancel");

const confirmOk =
    document.getElementById("confirmOk");

if (confirmCancel) {

    confirmCancel.addEventListener("click", () => {

        document.getElementById("confirmOverlay")
            .classList.remove("show");

    });

}

if (confirmOk) {

    confirmOk.addEventListener("click", () => {

        document.getElementById("confirmOverlay")
            .classList.remove("show");

        if (confirmCallback) {

            confirmCallback();

        }

    });

}