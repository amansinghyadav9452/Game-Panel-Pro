let clearLogsResolver = null;

const clearLogsOverlay = document.getElementById("clearLogsOverlay");
const clearUserLogsBtn = document.getElementById("clearUserLogsBtn");
const clearAdminLogsBtn = document.getElementById("clearAdminLogsBtn");
const clearLogsCancel = document.getElementById("clearLogsCancel");

// Resolves to "user", "admin", or null (cancelled).
function requestLogsToClear() {

    if (!clearLogsOverlay) {
        return Promise.resolve(null);
    }

    clearLogsOverlay.classList.add("show");

    return new Promise((resolve) => {
        clearLogsResolver = resolve;
    });

}

function closeClearLogsModal(result) {

    clearLogsOverlay.classList.remove("show");
    clearLogsResolver?.(result);
    clearLogsResolver = null;

}

if (clearUserLogsBtn) {

    clearUserLogsBtn.addEventListener("click", () => {
        closeClearLogsModal("user");
    });

}

if (clearAdminLogsBtn) {

    clearAdminLogsBtn.addEventListener("click", () => {
        closeClearLogsModal("admin");
    });

}

if (clearLogsCancel) {

    clearLogsCancel.addEventListener("click", () => {
        closeClearLogsModal(null);
    });

}

window.requestLogsToClear = requestLogsToClear;
