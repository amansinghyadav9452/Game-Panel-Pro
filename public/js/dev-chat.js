(function () {

    const toggleBtn = document.getElementById("devChatToggle");
    const panel = document.getElementById("devChatPanel");
    const closeBtn = document.getElementById("devChatClose");
    const messagesBox = document.getElementById("devChatMessages");
    const input = document.getElementById("devChatInput");
    const sendBtn = document.getElementById("devChatSend");
    const badge = document.getElementById("devChatBadge");
    const statusDot = document.getElementById("devChatStatusDot");
    const statusText = document.getElementById("devChatStatusText");

    if (!toggleBtn || typeof io === "undefined") return;

    let unreadCount = 0;
    let isOpen = false;
    let typingTimeout = null;

    function updateBadge() {

        if (unreadCount > 0) {

            badge.textContent = unreadCount > 9 ? "9+" : unreadCount;
            badge.style.display = "flex";

        }

        else {

            badge.style.display = "none";

        }

    }

    function timeLabel(dateStr) {

        return new Date(dateStr).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });

    }

    function renderMessage(msg) {

        const empty = messagesBox.querySelector(".dev-chat-empty");

        if (empty) empty.remove();

        const bubble = document.createElement("div");

        bubble.className =
            "dev-chat-bubble " + (msg.sender === "admin" ? "out" : "in");

        bubble.innerHTML = `
            ${msg.sender === "developer"
                ? `<span class="dev-chat-bubble-sender">${msg.senderLabel || "Developer"}</span>`
                : ""}
            ${escapeHtml(msg.text)}
            <span class="dev-chat-bubble-time">${timeLabel(msg.createdAt)}</span>
        `;

        messagesBox.appendChild(bubble);

        messagesBox.scrollTop = messagesBox.scrollHeight;

    }

    function escapeHtml(str) {

        const div = document.createElement("div");

        div.textContent = str;

        return div.innerHTML;

    }

    function openPanel() {

        isOpen = true;

        panel.classList.add("show");

        unreadCount = 0;

        updateBadge();

        input.focus();

    }

    function closePanel() {

        isOpen = false;

        panel.classList.remove("show");

    }

    toggleBtn.addEventListener("click", () => {

        isOpen ? closePanel() : openPanel();

    });

    closeBtn.addEventListener("click", closePanel);

    const token = localStorage.getItem("token");

    if (!token) return;

    const socket = io("/dev-chat", {

        auth: { role: "admin", token }

    });

    socket.on("connect", () => {

        statusDot.classList.add("online");
        statusText.textContent = "Online";

    });

    socket.on("disconnect", () => {

        statusDot.classList.remove("online");
        statusText.textContent = "Offline";

    });

    socket.on("connect_error", () => {

        statusDot.classList.remove("online");
        statusText.textContent = "Unavailable";

    });

    socket.on("chat:history", (history) => {

        messagesBox.innerHTML = "";

        if (!history.length) {

            messagesBox.innerHTML =
                `<p class="dev-chat-empty">No messages yet. Say hi 👋</p>`;

            return;

        }

        history.forEach(renderMessage);

    });

    socket.on("chat:message", (msg) => {

        renderMessage(msg);

        if (msg.sender === "developer" && !isOpen) {

            unreadCount++;

            updateBadge();

        }

    });

    socket.on("chat:typing", ({ from }) => {

        if (from !== "developer") return;

        let typingEl = messagesBox.querySelector(".dev-chat-typing");

        if (!typingEl) {

            typingEl = document.createElement("div");

            typingEl.className = "dev-chat-typing";

            typingEl.textContent = "Developer is typing...";

            messagesBox.appendChild(typingEl);

            messagesBox.scrollTop = messagesBox.scrollHeight;

        }

        clearTimeout(typingTimeout);

        typingTimeout = setTimeout(() => typingEl.remove(), 2000);

    });

    function sendMessage() {

        const text = input.value.trim();

        if (!text) return;

        socket.emit("chat:message", { text });

        input.value = "";

    }

    sendBtn.addEventListener("click", sendMessage);

    input.addEventListener("keydown", (e) => {

        if (e.key === "Enter") {

            sendMessage();

        }

        else {

            socket.emit("chat:typing");

        }

    });

})();
