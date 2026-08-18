(function () {

    const toggleBtn = document.getElementById("devChatToggle");
    const overlay = document.getElementById("devChatOverlay");
    const closeBtn = document.getElementById("devChatClose");
    const messagesBox = document.getElementById("devChatMessages");
    const input = document.getElementById("devChatInput");
    const sendBtn = document.getElementById("devChatSend");
    const badge = document.getElementById("devChatBadge");
    const presenceDot = document.getElementById("devChatPresenceDot");
    const statusText = document.getElementById("devChatStatusText");
    const peerTitle = document.getElementById("devChatPeerTitle");
    const typingRow = document.getElementById("devChatTypingRow");
    const msgMenu = document.getElementById("devChatMsgMenu");
    const unsendBtn = document.getElementById("devChatUnsendBtn");

    if (!toggleBtn || typeof io === "undefined") return;

    const token = localStorage.getItem("token");

    if (!token) return;

    let myRole = null;
    let peerOnline = false;
    let unreadCount = 0;
    let isOpen = false;
    let typingTimeout = null;
    let menuTargetId = null;
    let socket = null;

    // messageId -> latest known message object, so an "unsent" update
    // can re-render a bubble without scraping stale DOM text back out.
    const messageCache = new Map();

    function updateBadge() {

        if (unreadCount > 0) {

            badge.textContent = unreadCount > 9 ? "9+" : unreadCount;
            badge.style.display = "flex";
            toggleBtn.classList.add("has-unread");

        } else {

            badge.style.display = "none";
            toggleBtn.classList.remove("has-unread");

        }

    }

    function timeLabel(dateStr) {

        return new Date(dateStr).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });

    }

    function timeAgo(dateStr) {

        const diffMs = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diffMs / 60000);

        if (mins < 1) return "just now";
        if (mins < 60) return `${mins}m ago`;

        const hours = Math.floor(mins / 60);

        if (hours < 24) return `${hours}h ago`;

        return timeLabel(dateStr);

    }

    function escapeHtml(str) {

        const div = document.createElement("div");

        div.textContent = str;

        return div.innerHTML;

    }

    function roleLabel(role) {
        return role === "admin" ? "Admin" : "Developer";
    }

    function metaRowHtml(msg) {

        // Sirf apne bheje ("out") messages pe sent/seen tick dikhte
        // hain - baaki sirf time.
        if (msg.sender !== myRole) {

            return `<div class="dev-chat-meta-row">${timeLabel(msg.createdAt)}</div>`;

        }

        if (msg.seenAt) {

            return `
                <div class="dev-chat-meta-row" data-seen-row>
                    <i class="fa-solid fa-check-double dev-chat-tick seen"></i>
                    Seen ${timeAgo(msg.seenAt)}
                </div>
            `;

        }

        return `
            <div class="dev-chat-meta-row" data-seen-row>
                <i class="fa-solid fa-check dev-chat-tick"></i>
                Sent ${timeLabel(msg.createdAt)}
            </div>
        `;

    }

    function bubbleContentHtml(msg) {

        const isMine = msg.sender === myRole;

        const senderTag = !isMine
            ? `<span class="dev-chat-bubble-sender">${msg.senderLabel || roleLabel(msg.sender)}</span>`
            : "";

        if (msg.unsent) {

            if (isMine) {

                return `You unsent this message`;

            }

            const tagText = `Unsent by ${msg.senderLabel || roleLabel(msg.sender)} \u2022 ${timeLabel(msg.unsentAt)}`;

            return `
                ${senderTag}
                ${escapeHtml(msg.text)}
                <span class="dev-chat-unsent-tag"><i class="fa-solid fa-triangle-exclamation"></i> ${tagText}</span>
            `;

        }

        return `${senderTag}${escapeHtml(msg.text)}`;

    }

    function renderBubble(wrap, msg) {

        wrap.className =
            "dev-chat-bubble-wrap " + (msg.sender === myRole ? "out" : "in");

        wrap.innerHTML = `
            <div class="dev-chat-bubble${msg.unsent ? " unsent" : ""}">
                ${bubbleContentHtml(msg)}
            </div>
            ${metaRowHtml(msg)}
        `;

        const bubbleEl = wrap.querySelector(".dev-chat-bubble");

        if (msg.sender === myRole && !msg.unsent) {

            bubbleEl.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                openMsgMenu(msg._id, e.clientX, e.clientY);
            });

            let pressTimer = null;

            bubbleEl.addEventListener("touchstart", (e) => {
                const touch = e.touches[0];
                pressTimer = setTimeout(() => {
                    openMsgMenu(msg._id, touch.clientX, touch.clientY);
                }, 500);
            });

            bubbleEl.addEventListener("touchend", () => clearTimeout(pressTimer));
            bubbleEl.addEventListener("touchmove", () => clearTimeout(pressTimer));

        }

    }

    function renderMessage(msg) {

        const empty = messagesBox.querySelector(".dev-chat-empty");

        if (empty) empty.remove();

        messageCache.set(msg._id, msg);

        const wrap = document.createElement("div");

        wrap.dataset.id = msg._id;

        renderBubble(wrap, msg);

        messagesBox.appendChild(wrap);

        messagesBox.scrollTop = messagesBox.scrollHeight;

    }

    function updateMessage(id, patch) {

        const existing = messageCache.get(id);

        if (!existing) return;

        const updated = Object.assign({}, existing, patch);

        messageCache.set(id, updated);

        const wrap = messagesBox.querySelector(`[data-id="${id}"]`);

        if (wrap) renderBubble(wrap, updated);

    }

    function openMsgMenu(messageId, x, y) {

        menuTargetId = messageId;

        msgMenu.classList.add("show");

        const menuWidth = 140;
        const menuHeight = 44;

        msgMenu.style.left = Math.min(x, window.innerWidth - menuWidth - 12) + "px";
        msgMenu.style.top = Math.min(y, window.innerHeight - menuHeight - 12) + "px";

    }

    function closeMsgMenu() {
        menuTargetId = null;
        msgMenu.classList.remove("show");
    }

    document.addEventListener("click", (e) => {
        if (!msgMenu.contains(e.target)) closeMsgMenu();
    });

    unsendBtn.addEventListener("click", () => {

        if (menuTargetId && socket) {
            socket.emit("chat:delete", { messageId: menuTargetId });
        }

        closeMsgMenu();

    });

    function setPeerPresence(online) {

        peerOnline = online;

        presenceDot.classList.toggle("online", online);

        statusText.textContent = online ? "Online" : "Offline";

    }

    function openPanel() {

        isOpen = true;

        overlay.classList.add("show");

        unreadCount = 0;

        updateBadge();

        input.focus();

        if (socket) socket.emit("chat:mark-seen");

    }

    function closePanel() {

        isOpen = false;

        overlay.classList.remove("show");

    }

    toggleBtn.addEventListener("click", () => {
        isOpen ? closePanel() : openPanel();
    });

    if (closeBtn) {
        closeBtn.addEventListener("click", closePanel);
    }

    // Pehle apna role pata karo (admin ya developer), fir uske hisaab
    // se peer ka title set karo aur socket connect karo.
    fetch("/messenger/session", {
        headers: { Authorization: `Bearer ${token}` }
    })
        .then((res) => {
            if (!res.ok) throw new Error("unauthorized");
            return res.json();
        })
        .then((data) => {

            if (!data.success) throw new Error("unauthorized");

            myRole = data.role;

            if (peerTitle) {
                peerTitle.textContent = myRole === "admin" ? "Developer" : "Admin";
            }

            connectSocket();

        })
        .catch(() => {
            // Session invalid - widget chup rehta hai; page ka apna
            // auth-check (jahan hai) login pe bhej dega.
        });

    function connectSocket() {

        socket = io("/dev-chat", {
            auth: { token }
        });

        socket.on("connect", () => {
            statusText.textContent = peerOnline ? "Online" : "Offline";
        });

        socket.on("disconnect", () => {
            statusText.textContent = "Reconnecting...";
        });

        socket.on("connect_error", () => {
            statusText.textContent = "Unavailable";
        });

        socket.on("presence:update", ({ role, online }) => {

            if (role === myRole) return;

            setPeerPresence(online);

        });

        socket.on("chat:history", (history) => {

            messagesBox.innerHTML = "";
            messageCache.clear();

            if (!history.length) {

                messagesBox.innerHTML =
                    `<p class="dev-chat-empty">No messages yet. Say hi 👋</p>`;

                return;

            }

            history.forEach(renderMessage);

            if (isOpen) socket.emit("chat:mark-seen");

        });

        socket.on("chat:message", (msg) => {

            renderMessage(msg);

            if (msg.sender !== myRole) {

                if (isOpen) {

                    socket.emit("chat:mark-seen");

                } else {

                    unreadCount++;
                    updateBadge();

                }

                if (typeof showToast === "function") {

                    showToast(
                        msg.senderLabel || roleLabel(msg.sender),
                        msg.text.length > 80 ? msg.text.slice(0, 80) + "..." : msg.text,
                        "info"
                    );

                }

            }

        });

        socket.on("chat:seen", ({ messageIds }) => {

            messageIds.forEach((id) => {
                updateMessage(id, { seenAt: new Date().toISOString() });
            });

        });

        socket.on("chat:unsent", ({ messageId, unsentAt, unsentBy }) => {

            updateMessage(messageId, { unsent: true, unsentAt });

        });

        socket.on("chat:typing", ({ from }) => {

            if (from === myRole) return;

            typingRow.style.display = "block";

            clearTimeout(typingTimeout);

            typingTimeout = setTimeout(() => {
                typingRow.style.display = "none";
            }, 2000);

        });

    }

    function sendMessage() {

        const text = input.value.trim();

        if (!text || !socket) return;

        socket.emit("chat:message", { text });

        input.value = "";

    }

    sendBtn.addEventListener("click", sendMessage);

    input.addEventListener("keydown", (e) => {

        if (e.key === "Enter") {

            sendMessage();

        } else if (socket) {

            socket.emit("chat:typing");

        }

    });

})();
