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
    const moreBtn = document.getElementById("devChatMoreBtn");
    const moreMenu = document.getElementById("devChatMoreMenu");
    const clearChatBtn = document.getElementById("devChatClearChatBtn");
    const clearOverlay = document.getElementById("devChatClearOverlay");
    const clearForMeBtn = document.getElementById("devChatClearForMeBtn");
    const clearForEveryoneBtn = document.getElementById("devChatClearForEveryoneBtn");
    const clearCancelBtn = document.getElementById("devChatClearCancelBtn");

    if (!toggleBtn || typeof io === "undefined") return;

    const token = localStorage.getItem("token") || localStorage.getItem("customerToken");

    if (!token) return;

    let myRole = null;
    let peerOnline = false;
    let unreadCount = 0;
    let isOpen = false;
    let typingTimeout = null;
    let menuTargetId = null;
    let socket = null;

    // Developer-only: which thread is currently open in the panel.
    // null = Admin thread, otherwise a customer's _id.
    let currentConversationId = null;
    let conversationsList = [];

    const convSelect = document.getElementById("devChatConversationSelect");

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
        if (role === "admin") return "Admin";
        if (role === "customer") return "Customer";
        return "Developer";
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
        if (moreMenu && !moreMenu.contains(e.target) && e.target !== moreBtn) {
            moreMenu.classList.remove("show");
        }
    });

    unsendBtn.addEventListener("click", () => {

        if (menuTargetId && socket) {
            socket.emit("chat:delete", { messageId: menuTargetId });
        }

        closeMsgMenu();

    });

    function showEmptyState() {

        messagesBox.innerHTML =
            `<p class="dev-chat-empty">No messages yet. Say hi 👋</p>`;

    }

    function clearLocalChat() {

        messagesBox.innerHTML = "";
        messageCache.clear();
        showEmptyState();
        unreadCount = 0;
        updateBadge();

    }

    function openClearSheet() {
        clearOverlay.classList.add("show");
    }

    function closeClearSheet() {
        clearOverlay.classList.remove("show");
    }

    if (moreBtn && moreMenu) {

        moreBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            moreMenu.classList.toggle("show");
        });

    }

    if (clearChatBtn) {

        clearChatBtn.addEventListener("click", () => {
            moreMenu.classList.remove("show");
            openClearSheet();
        });

    }

    if (clearCancelBtn) {
        clearCancelBtn.addEventListener("click", closeClearSheet);
    }

    if (clearForMeBtn) {

        clearForMeBtn.addEventListener("click", () => {

            if (socket) socket.emit("chat:clear-for-me");
            closeClearSheet();

        });

    }

    if (clearForEveryoneBtn) {

        clearForEveryoneBtn.addEventListener("click", () => {

            const sure = window.confirm(
                "Delete this entire conversation for everyone? This can't be undone."
            );

            if (!sure) return;

            if (socket) {
                socket.emit(
                    "chat:clear-for-everyone",
                    myRole === "developer" ? { customerId: currentConversationId } : undefined
                );
            }
            closeClearSheet();

        });

    }

    function setPeerPresence(online) {

        peerOnline = online;

        presenceDot.classList.toggle("online", online);

        statusText.textContent = online ? "Online" : "Offline";

    }

    function openPanel() {

        isOpen = true;

        overlay.classList.add("show");

        if (myRole !== "developer") {
            unreadCount = 0;
            updateBadge();
        }

        input.focus();

        if (socket) socket.emit("chat:mark-seen", { customerId: currentConversationId });

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

                if (myRole === "admin" || myRole === "customer") {
                    peerTitle.textContent = "Developer";
                } else {
                    // Developer: title tracks whichever thread is open -
                    // starts on the Admin thread.
                    peerTitle.textContent = "Admin";
                }

            }

            if (convSelect) {
                convSelect.style.display = myRole === "developer" ? "" : "none";
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

                showEmptyState();

                // Nothing to be unread about.
                unreadCount = 0;
                updateBadge();

                return;

            }

            history.forEach(renderMessage);

            if (isOpen) {

                socket.emit("chat:mark-seen");

            } else {

                // Badge ab yahan se accurately set hota hai - server ab
                // connect hote hi messages ko chup-chaap "seen" mark
                // nahi karta, isliye history me jo bhi doosre role ka
                // bheja hua aur abhi tak humari taraf se unread hai,
                // wahi count hota hai. Ye fix karta hai wo case jahan
                // panel band tha jab dusra msg aaya tha aur page baad
                // me reload/reopen hui - pehle badge hamesha 0 dikhata
                // tha is situation me.
                const readField =
                    myRole === "admin" ? "readByAdmin" : "readByDeveloper";

                unreadCount = history.filter(
                    (m) => m.sender !== myRole && !m[readField]
                ).length;

                updateBadge();

            }

        });

        socket.on("chat:message", (msg) => {

            // Developer: multiple threads share one socket connection -
            // only render the message if it belongs to whichever thread
            // is currently open. Anything else just bumps the
            // conversation list / a toast, handled by chat:conversations.
            if (myRole === "developer") {

                const msgConvId = msg.customerId ? String(msg.customerId) : null;

                if (msgConvId !== currentConversationId) {

                    if (msg.sender !== "developer" && typeof showToast === "function") {

                        showToast(
                            msg.senderLabel || roleLabel(msg.sender),
                            msg.text.length > 80 ? msg.text.slice(0, 80) + "..." : msg.text,
                            "info"
                        );

                    }

                    return;

                }

            }

            renderMessage(msg);

            if (msg.sender !== myRole) {

                if (isOpen) {

                    socket.emit("chat:mark-seen", { customerId: currentConversationId });

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

        // Developer only: list of "Admin" + every customer thread, with
        // unread counts, so the operator can see who is waiting.
        socket.on("chat:conversations", (list) => {

            conversationsList = list || [];

            if (!convSelect) return;

            const totalUnread = conversationsList.reduce((sum, c) => sum + (c.unread || 0), 0);

            unreadCount = totalUnread;
            updateBadge();

            const selected = currentConversationId;

            convSelect.innerHTML = conversationsList.map((c) => {

                const label = c.unread
                    ? `${c.label} (${c.unread})`
                    : c.label;

                return `<option value="${c.id || ""}">${escapeHtml(label)}</option>`;

            }).join("");

            convSelect.value = selected || "";

        });

        // Developer only: history for whichever thread was just
        // switched to via the conversation dropdown.
        socket.on("chat:conversation-history", ({ customerId, history }) => {

            currentConversationId = customerId || null;

            if (peerTitle) {

                const conv = conversationsList.find(c => (c.id || null) === currentConversationId);

                peerTitle.textContent = conv ? conv.label : (currentConversationId ? "Customer" : "Admin");

            }

            messagesBox.innerHTML = "";
            messageCache.clear();

            if (!history.length) {

                showEmptyState();

            } else {

                history.forEach(renderMessage);

                if (isOpen) socket.emit("chat:mark-seen", { customerId: currentConversationId });

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

        socket.on("chat:cleared", ({ scope, customerId }) => {

            // scope "me" only reaches the account that triggered it;
            // scope "everyone" is broadcast to that thread's parties.
            // Developer sees multiple threads on one socket - only wipe
            // the view if it's the thread currently open.
            if (myRole === "developer") {

                const convId = customerId ? String(customerId) : null;

                if (convId !== currentConversationId) return;

            }

            clearLocalChat();

            if (typeof showToast === "function" && scope === "everyone") {

                showToast("Messenger", "Chat cleared for everyone.", "info");

            }

        });

        socket.on("chat:typing", ({ from, customerId }) => {

            if (from === myRole) return;

            if (myRole === "developer") {

                const fromConvId = customerId ? String(customerId) : null;

                if (fromConvId !== currentConversationId) return;

            }

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

        const payload = { text };

        if (myRole === "developer") {
            payload.customerId = currentConversationId;
        }

        socket.emit("chat:message", payload);

        input.value = "";

    }

    sendBtn.addEventListener("click", sendMessage);

    input.addEventListener("keydown", (e) => {

        if (e.key === "Enter") {

            sendMessage();

        } else if (socket) {

            socket.emit(
                "chat:typing",
                myRole === "developer" ? { customerId: currentConversationId } : undefined
            );

        }

    });

    if (convSelect) {

        convSelect.addEventListener("change", () => {

            if (!socket || myRole !== "developer") return;

            const customerId = convSelect.value || null;

            socket.emit("chat:switch-conversation", { customerId });

        });

    }

})();
