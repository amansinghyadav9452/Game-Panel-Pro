function showToast(message, type = "success") {

    const toast = document.getElementById("toast");

    if (!toast) return;

    toast.textContent = message;

    toast.className = "";

    toast.classList.add(type);

    toast.classList.add("show");

    setTimeout(() => {

        toast.classList.remove("show");

    }, 2500);

}

function formatDate(date) {

    return new Date(date).toLocaleDateString();

}

function copyText(text) {

    navigator.clipboard.writeText(text);

    showToast("Copied Successfully");

}

function openSidebar() {

    const sidebar = document.querySelector(".sidebar");
    const overlay = document.getElementById("overlay");

    if (!sidebar || !overlay) return;

    sidebar.classList.add("active");
    overlay.classList.add("active");

}

function closeSidebar() {

    const sidebar = document.querySelector(".sidebar");
    const overlay = document.getElementById("overlay");

    if (!sidebar || !overlay) return;

    sidebar.classList.remove("active");
    overlay.classList.remove("active");

}

function initAutoLogout(timeout = 15 * 60 * 1000) {

    let timer;

    function logout() {

        localStorage.removeItem("token");

        localStorage.removeItem("logoutAt");

        showToast("Session Expired");

        setTimeout(() => {

            window.location.replace("/login");

        }, 1000);

    }

    function resetTimer() {

        clearTimeout(timer);

        const logoutAt = Date.now() + timeout;

        localStorage.setItem("logoutAt", logoutAt);

        timer = setTimeout(logout, timeout);

    }

    const logoutAt =
        Number(localStorage.getItem("logoutAt"));

    if (logoutAt && Date.now() >= logoutAt) {

        logout();

        return;

    }

    if (logoutAt) {

        timer = setTimeout(

            logout,

            logoutAt - Date.now()

        );

    } else {

        resetTimer();

    }

    [

        "click",

        "mousemove",

        "keydown",

        "scroll",

        "touchstart"

    ].forEach((event) => {

        document.addEventListener(event, resetTimer);

    });

    document.addEventListener("visibilitychange", () => {

    if (document.visibilityState === "visible") {

        const logoutAt = Number(localStorage.getItem("logoutAt"));

        if (logoutAt && Date.now() >= logoutAt) {

            logout();

        }

    }

});

window.addEventListener("focus", () => {

    const logoutAt = Number(localStorage.getItem("logoutAt"));

    if (logoutAt && Date.now() >= logoutAt) {

        logout();

    }

});
}