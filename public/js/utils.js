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

function initSidebar() {

    const menuBtn = document.getElementById("menuBtn");
    const overlay = document.getElementById("overlay");

    if (menuBtn) {

        menuBtn.addEventListener("click", openSidebar);

    }

    if (overlay) {

        overlay.addEventListener("click", closeSidebar);

    }

    document.addEventListener("keydown", (e) => {

        if (e.key === "Escape") {

            closeSidebar();

        }

    });

}

function initAutoLogout(timeout = 15 * 60 * 1000) {

    let timer;

    function resetTimer() {

        clearTimeout(timer);

        timer = setTimeout(() => {

            localStorage.removeItem("token");

            showToast("Session Expired");

            setTimeout(() => {

                window.location.replace("/login");

            }, 1000);

        }, timeout);

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

    resetTimer();

}