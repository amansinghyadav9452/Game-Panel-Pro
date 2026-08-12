const viewSessionsBtn = document.getElementById("viewSessionsBtn");
const sessionsModal = document.getElementById("sessionsModal");
const closeSessionsModal = document.getElementById("closeSessionsModal");
const sessionsList = document.getElementById("sessionsList");
const logoutAllBtn = document.getElementById("logoutAllBtn");

function timeAgo(dateStr) {

    const diffMs = Date.now() - new Date(dateStr).getTime();

    const mins = Math.floor(diffMs / 60000);

    if (mins < 1) return "Just now";

    if (mins < 60) return `${mins}m ago`;

    const hrs = Math.floor(mins / 60);

    if (hrs < 24) return `${hrs}h ago`;

    const days = Math.floor(hrs / 24);

    return `${days}d ago`;

}

function deviceIcon(deviceLabel = "") {

    if (/android|ios/i.test(deviceLabel)) return "fa-mobile-screen";

    if (/windows|macos|linux/i.test(deviceLabel)) return "fa-desktop";

    return "fa-display";

}

async function loadSessions() {

    if (!sessionsList) return;

    sessionsList.innerHTML =
        `<p class="sessions-empty">Loading sessions...</p>`;

    const token = localStorage.getItem("token");

    try {

        const response = await fetch("/settings/account/sessions", {

            headers: {

                Authorization: `Bearer ${token}`

            }

        });

        const data = await response.json();

        if (!data.success || !data.sessions.length) {

            sessionsList.innerHTML =
                `<p class="sessions-empty">No active sessions found.</p>`;

            return;

        }

        sessionsList.innerHTML = data.sessions.map(s => `
            <div class="session-item" data-id="${s.id}">

                <div class="session-swipe-action">

                    <i class="fa-solid fa-trash"></i>

                    Terminate

                </div>

                <div class="session-content">

                    <div class="session-icon">

                        <i class="fa-solid ${deviceIcon(s.deviceLabel)}"></i>

                    </div>

                    <div class="session-info">

                        <div class="session-device">

                            ${s.deviceLabel}

                            ${s.current
                                ? '<span class="session-current-badge">This device</span>'
                                : ""}

                        </div>

                        <div class="session-meta">

                            ${s.ip ? s.ip + " &bull; " : ""}${timeAgo(s.lastActiveAt)}

                        </div>

                    </div>

                </div>

            </div>
        `).join("");

        attachSwipeHandlers();

    }

    catch (error) {

        console.error(error);

        sessionsList.innerHTML =
            `<p class="sessions-empty" style="color:#EF4444;">Failed to load sessions.</p>`;

    }

}

function attachSwipeHandlers() {

    document.querySelectorAll(".session-item").forEach(item => {

        const content = item.querySelector(".session-content");
        const actionZone = item.querySelector(".session-swipe-action");
        const revealWidth = actionZone.offsetWidth || 100;

        let startX = 0;
        let currentX = 0;
        let dragging = false;
        let openedByPointerId = null;

        content.addEventListener("pointerdown", (e) => {

            startX = e.clientX;
            dragging = true;
            openedByPointerId = e.pointerId;
            content.classList.add("dragging");

            try {
                content.setPointerCapture(e.pointerId);
            } catch (err) {}

        });

        content.addEventListener("pointermove", (e) => {

            if (!dragging || e.pointerId !== openedByPointerId) return;

            const delta = e.clientX - startX;

            currentX = Math.max(0, Math.min(delta, revealWidth));

            content.style.transform = `translateX(${currentX}px)`;

        });

        function endDrag(e) {

            if (!dragging) return;

            dragging = false;

            content.classList.remove("dragging");

            if (currentX > revealWidth / 2) {

                content.style.transform = `translateX(${revealWidth}px)`;

            }

            else {

                content.style.transform = `translateX(0)`;

            }

            currentX = 0;

        }

        content.addEventListener("pointerup", endDrag);
        content.addEventListener("pointercancel", endDrag);

        actionZone.addEventListener("click", async () => {

            const sessionId = item.dataset.id;
            const token = localStorage.getItem("token");
            const isCurrent = !!item.querySelector(".session-current-badge");

            try {

                const response = await fetch(
                    `/settings/account/sessions/${sessionId}`,
                    {
                        method: "DELETE",
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                const data = await response.json();

                if (data.success) {

                    if (isCurrent) {

                        localStorage.removeItem("token");
                        localStorage.removeItem("logoutAt");
                        window.location.replace("/login");
                        return;

                    }

                    item.style.transition = ".25s ease";
                    item.style.opacity = "0";
                    item.style.maxHeight = item.offsetHeight + "px";

                    requestAnimationFrame(() => {
                        item.style.maxHeight = "0px";
                        item.style.marginBottom = "0px";
                    });

                    setTimeout(() => item.remove(), 250);

                    showToast("Success", "Session terminated.", "success");

                }

                else {

                    showToast(
                        "Error",
                        data.message || "Something went wrong.",
                        "error"
                    );

                    content.style.transform = "translateX(0)";

                }

            }

            catch (error) {

                console.error(error);

                showToast("Error", "Something went wrong.", "error");

            }

        });

    });

}

if (viewSessionsBtn) {

    viewSessionsBtn.addEventListener("click", () => {

        sessionsModal.classList.add("show");

        loadSessions();

    });

}

if (closeSessionsModal) {

    closeSessionsModal.addEventListener("click", () => {

        sessionsModal.classList.remove("show");

    });

}

window.addEventListener("click", (e) => {

    if (e.target === sessionsModal) {

        sessionsModal.classList.remove("show");

    }

});

if (logoutAllBtn) {

    logoutAllBtn.addEventListener("click", () => {

        showConfirm(

            "Logout All Devices",

            "This will sign you out on this device and every other device. Continue?",

            async () => {

                const token = localStorage.getItem("token");

                try {

                    const response = await fetch(

                        "/settings/account/logout-all",

                        {

                            method: "POST",

                            headers: {

                                Authorization: `Bearer ${token}`

                            }

                        }

                    );

                    const data = await response.json();

                    if (data.success) {

                        localStorage.removeItem("token");

                        localStorage.removeItem("logoutAt");

                        window.location.replace("/login");

                    }

                    else {

                        showToast(
                            "Error",
                            data.message || "Something went wrong.",
                            "error"
                        );

                    }

                }

                catch (error) {

                    console.error(error);

                    showToast("Error", "Something went wrong.", "error");

                }

            }

        );

    });

}
