(function () {

    const gateBox = document.getElementById("devGateBox");
    const gateInput = document.getElementById("devGateInput");
    const gateBtn = document.getElementById("devGateBtn");
    const gateError = document.getElementById("devGateError");

    const chatBox = document.getElementById("devChatStandaloneBox");
    const messagesBox = document.getElementById("devChatMessages");
    const input = document.getElementById("devChatInput");
    const sendBtn = document.getElementById("devChatSend");
    const statusDot = document.getElementById("devChatStatusDot");
    const statusText = document.getElementById("devChatStatusText");

    let socket = null;
    let typingTimeout = null;

    function timeLabel(dateStr) {

        return new Date(dateStr).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });

    }

    function escapeHtml(str) {

        const div = document.createElement("div");

        div.textContent = str;

        return div.innerHTML;

    }

    function renderMessage(msg) {

        const empty = messagesBox.querySelector(".dev-chat-empty");

        if (empty) empty.remove();

        const bubble = document.createElement("div");

        bubble.className =
            "dev-chat-bubble " + (msg.sender === "developer" ? "out" : "in");

        bubble.innerHTML = `
            ${msg.sender === "admin"
                ? `<span class="dev-chat-bubble-sender">${msg.senderLabel || "Admin"}</span>`
                : ""}
            ${escapeHtml(msg.text)}
            <span class="dev-chat-bubble-time">${timeLabel(msg.createdAt)}</span>
        `;

        messagesBox.appendChild(bubble);

        messagesBox.scrollTop = messagesBox.scrollHeight;

    }

    function connectWithKey(key) {

        socket = io("/dev-chat", {

            auth: { role: "developer", key }

        });

        socket.on("connect", () => {

            gateBox.style.display = "none";

            chatBox.classList.add("show");

            localStorage.setItem("gp_dev_key", key);

            statusDot.classList.add("online");
            statusText.textContent = "Online";

        });

        socket.on("connect_error", () => {

            if (chatBox.classList.contains("show")) {

                statusDot.classList.remove("online");
                statusText.textContent = "Unavailable";

                return;

            }

            gateError.style.display = "block";

            gateBtn.disabled = false;
            gateBtn.textContent = "Continue";

            localStorage.removeItem("gp_dev_key");

        });

        socket.on("disconnect", () => {

            statusDot.classList.remove("online");
            statusText.textContent = "Offline";

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

        socket.on("chat:message", renderMessage);

        socket.on("chat:typing", ({ from }) => {

            if (from !== "admin") return;

            let typingEl = messagesBox.querySelector(".dev-chat-typing");

            if (!typingEl) {

                typingEl = document.createElement("div");

                typingEl.className = "dev-chat-typing";

                typingEl.textContent = "Admin is typing...";

                messagesBox.appendChild(typingEl);

                messagesBox.scrollTop = messagesBox.scrollHeight;

            }

            clearTimeout(typingTimeout);

            typingTimeout = setTimeout(() => typingEl.remove(), 2000);

        });

    }

    function attemptGate() {

        const key = gateInput.value.trim();

        if (!key) return;

        gateError.style.display = "none";

        gateBtn.disabled = true;
        gateBtn.textContent = "Checking...";

        connectWithKey(key);

    }

    gateBtn.addEventListener("click", attemptGate);

    gateInput.addEventListener("keydown", (e) => {

        if (e.key === "Enter") attemptGate();

    });

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

        }

        else if (socket) {

            socket.emit("chat:typing");

        }

    });

    // Agar pehle se ek valid key browser me saved hai, dobara type nahi
    // karni padegi - seedha connect try karega.
    const savedKey = localStorage.getItem("gp_dev_key");

    if (savedKey) {

        gateInput.value = savedKey;

        connectWithKey(savedKey);

    }

})();
