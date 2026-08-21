function formatDate(date) {

    return new Date(date).toLocaleDateString();

}

// ---------------------------------------------------------------
// Role helpers - this panel has no server-side session, access is
// entirely driven by which token is in localStorage. "admin" token
// wins if somehow both are present (shouldn't normally happen, each
// login flow only ever writes its own key).
// ---------------------------------------------------------------

function getPanelRole() {

    if (localStorage.getItem("token")) return "admin";
    if (localStorage.getItem("customerToken")) return "customer";
    return null;

}

// Settings / Banned Devices / Referrals are admin-only. A customer
// clicking one of those nav links gets this message instead of the
// page loading.
function initRestrictedNav() {

    if (getPanelRole() !== "customer") return;

    document.querySelectorAll('a[data-admin-only="true"]').forEach((link) => {

        link.classList.add("nav-restricted");

        link.addEventListener("click", (e) => {

            e.preventDefault();

            if (typeof showToast === "function") {

                showToast("Restricted", "Sorry, it's allowed only to the admin.", "error");

            } else {

                alert("Sorry, it's allowed only to the admin.");

            }

        });

    });

}

// Hides sidebar controls a customer should never see (profile picture
// upload/view, display-name editing) even though the same sidebar
// markup is shared with the admin panel.
function applyCustomerSidebarRestrictions() {

    if (getPanelRole() !== "customer") return;

    const profileInput = document.getElementById("profileInput");
    const profileMenu = document.getElementById("profileMenu");
    const displayNameMenu = document.getElementById("displayNameMenu");

    if (profileInput) profileInput.remove();
    if (profileMenu) profileMenu.remove();
    if (displayNameMenu) displayNameMenu.remove();

    const avatar = document.getElementById("profileAvatar");

    if (avatar) avatar.style.cursor = "default";

}

function copyText(text, btnEl) {

    navigator.clipboard.writeText(text);

    showToast("Success", "Copied Successfully");

    if (typeof gpHaptic === "function") {
        gpHaptic(15);
    }

    if (btnEl) {

        const icon = btnEl.querySelector("i");

        const originalIconClass = icon ? icon.className : null;

        btnEl.classList.add("gp-copy-pop", "gp-copied");

        if (icon) {
            icon.className = "fa-solid fa-check";
        }

        setTimeout(() => {

            btnEl.classList.remove("gp-copy-pop", "gp-copied");

            if (icon && originalIconClass) {
                icon.className = originalIconClass;
            }

        }, 900);

    }

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
    const closeBtn = document.getElementById("closeSidebar");

    if (menuBtn) {
        menuBtn.addEventListener("click", openSidebar);
    }

    if (overlay) {
        overlay.addEventListener("click", closeSidebar);
    }

    if (closeBtn) {
        closeBtn.addEventListener("click", closeSidebar);
    }

}

function initAutoLogout(timeout = 15 * 60 * 1000) {

    let timer;

    function logout() {

        if (getPanelRole() === "customer") {
            localStorage.removeItem("customerToken");
        } else {
            localStorage.removeItem("token");
        }

        localStorage.removeItem("logoutAt");

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

document.addEventListener("DOMContentLoaded", () => {

    initSidebar();

    initAutoLogout();

    initRestrictedNav();

    applyCustomerSidebarRestrictions();

    loadProfilePhoto();

    initDisplayNameMenu();

    initDisplayNameEditor();

    initProfileMenu();

    handleProfileUpload();

});

async function loadProfilePhoto() {

    const avatar = document.getElementById("profileAvatar");

    if (!avatar) return;

    const role = getPanelRole();

    if (role === "customer") {

        const token = localStorage.getItem("customerToken");

        if (!token) return;

        try {

            const res = await fetch("/customer/me", {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await res.json();

            if (!data.success) return;

            const displayName = document.getElementById("adminDisplayName");

            if (displayName) {
                displayName.textContent =
                    data.panelProfile?.displayName || "Administrator";
            }

            // Reuse the exact panel profile configured by the admin.
            // No customer-specific avatar is created here, so the
            // customer sidebar stays visually identical to the admin
            // sidebar.
            const img = avatar.querySelector(".profile-photo");
            const letter = avatar.querySelector(".profile-letter");

            if (data.panelProfile?.profileImage) {

                if (letter) letter.remove();

                let profileImg = img;

                if (!profileImg) {
                    profileImg = document.createElement("img");
                    profileImg.className = "profile-photo";
                    profileImg.alt = "Profile";
                    avatar.insertBefore(profileImg, avatar.firstChild);
                }

                profileImg.src =
                    `${data.panelProfile.profileImage}?t=${Date.now()}`;

            } else if (img) {

                img.remove();

            }

        } catch (err) {

            console.error(err);

        }

        return;

    }

    const token = localStorage.getItem("token");

    if (!token) return;

    try {

        const res = await fetch("/settings/account/me", {

            headers: {

                Authorization: `Bearer ${token}`

            }

        });

        const data = await res.json();

        if (!data.success) return;

const img = avatar.querySelector(".profile-photo");
if (data.admin.profileImage) {

    let img =
        avatar.querySelector(".profile-photo");

    if (!img) {

        const letter =
            avatar.querySelector(".profile-letter");

        if (letter) {

            letter.remove();

        }

        img =
            document.createElement("img");

        img.className = "profile-photo";

        img.alt = "Profile";

        avatar.insertBefore(
            img,
            document.getElementById("profileInput")
        );

    }

    img.src =
        `${data.admin.profileImage}?t=${Date.now()}`;

}
        const displayName =
    document.getElementById("adminDisplayName");

if (displayName) {

    displayName.textContent =
        data.admin.displayName || "Administrator";

}

    } catch (err) {

        console.error(err);

    }

}

function initDisplayNameEditor() {

    const btn = document.getElementById("editNameBtn");
    const title = document.getElementById("adminDisplayName");

    if (!btn || !title) return;

    btn.onclick = () => {

        const currentName = title.textContent;

        title.outerHTML = `
            <input
                id="displayNameInput"
                type="text"
                maxlength="30"
                value="${currentName}">
        `;

        const input =
            document.getElementById("displayNameInput");

        input.focus();
        input.select();

const cancelEdit = (e) => {

    if (e.target === input) return;

    input.outerHTML = `
        <h3 id="adminDisplayName">
            ${currentName}
        </h3>
    `;

    initDisplayNameMenu();
    initDisplayNameEditor();

};

setTimeout(() => {

    document.addEventListener(
        "click",
        cancelEdit,
        { once: true }
    );

}, 0);

        input.addEventListener("keydown", async (e) => {

            if (e.key !== "Enter") return;

            const token =
                localStorage.getItem("token");

            const res = await fetch(
                "/settings/display-name",
                {

                    method: "PUT",

                    headers: {

                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${token}`

                    },

                    body: JSON.stringify({

                        displayName:
                            input.value.trim()

                    })

                }
            );

            const data = await res.json();

            if (!data.success) {

                showToast(
                    "Error",
                    data.message,
                    "error"
                );

                return;

            }

            input.outerHTML = `
                <h3 id="adminDisplayName">
                    ${data.displayName}
                </h3>
            `;

            initDisplayNameMenu();
            initDisplayNameEditor();

            showToast(
                "Success",
                "Display Name Updated"
            );

        });

    };

}

function initDisplayNameMenu() {

    const title = document.getElementById("adminDisplayName");
    const menu = document.getElementById("displayNameMenu");
    const editBtn = document.getElementById("editNameBtn");

    if (!title || !menu || !editBtn) return;

    title.addEventListener("click", (e) => {

        e.stopPropagation();

        menu.classList.toggle("show");

    });

    menu.addEventListener("click", (e) => {

        e.stopPropagation();

    });

    document.addEventListener("click", () => {

        menu.classList.remove("show");

    });

    editBtn.onclick = () => {

        menu.classList.remove("show");

        initDisplayNameEditor();

    };

}

function initProfileMenu() {

    const avatar = document.getElementById("profileAvatar");
    const menu = document.getElementById("profileMenu");

    const viewBtn = document.getElementById("viewProfileBtn");
    const updateBtn = document.getElementById("updateProfileBtn");

    const viewer = document.getElementById("profileViewer");
    const viewerImage = document.getElementById("viewerImage");

    const closeViewer = document.getElementById("closeViewer");

    const input = document.getElementById("profileInput");

    if (
        !avatar ||
        !menu ||
        !viewBtn ||
        !updateBtn ||
        !viewer ||
        !viewerImage ||
        !closeViewer ||
        !input
    ) {
        return;
    }

    avatar.addEventListener("click", (e) => {

        e.stopPropagation();

        menu.classList.toggle("show");

    });

    document.addEventListener("click", () => {

        menu.classList.remove("show");

    });

    menu.addEventListener("click", (e) => {

        e.stopPropagation();

    });

    viewBtn.addEventListener("click", () => {
const img =
    avatar.querySelector(".profile-photo");

if (!img) {

    showToast(
        "Error",
        "No profile picture found",
        "error"
    );

    return;

}
        viewerImage.src = img.src;

        viewer.classList.add("show");

        menu.classList.remove("show");

    });

    updateBtn.addEventListener("click", () => {

        input.click();

        menu.classList.remove("show");

    });

    closeViewer.addEventListener("click", () => {

        viewer.classList.remove("show");

    });

    viewer.addEventListener("click", (e) => {

        if (e.target === viewer) {

            viewer.classList.remove("show");

        }

    });

    document.addEventListener("keydown", (e) => {

    if (e.key === "Escape") {

        viewer.classList.remove("show");

    }

});

}

function handleProfileUpload() {

    const input = document.getElementById("profileInput");

    if (!input) return;

    input.addEventListener("change", async () => {

        if (!input.files.length) return;

        const formData = new FormData();

        formData.append("profile", input.files[0]);

        const token = localStorage.getItem("token");

        try {

            const res = await fetch("/settings/profile/upload", {

                method: "POST",

                headers: {

                    Authorization: `Bearer ${token}`

                },

                body: formData

            });

            const data = await res.json();

            if (!data.success) {

                showToast("Error", data.message, "error");

                return;

            }

            await loadProfilePhoto();

            const menu = document.getElementById("profileMenu");

            if (menu) {

             menu.classList.remove("show");

            }

            showToast("Success", "Profile picture updated");

        }

        catch (err) {

            console.error(err);

            showToast("Error", "Upload Failed", "error");

        }

    });

}

const sidebarLogoutBtn = document.getElementById("sidebarLogout");

if (sidebarLogoutBtn) {

    sidebarLogoutBtn.addEventListener("click", (e) => {

        e.preventDefault();

        if (getPanelRole() === "customer") {
            localStorage.removeItem("customerToken");
        } else {
            localStorage.removeItem("token");
        }

        localStorage.removeItem("logoutAt");

        window.location.replace("/login");

    });

}