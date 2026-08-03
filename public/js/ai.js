(function () {

    const toggleBtn = document.getElementById("aiCopilotToggle");
    const overlay = document.getElementById("aiCopilotOverlay");
    const drawer = document.getElementById("aiCopilotDrawer");
    const closeBtn = document.getElementById("aiCopilotCloseBtn");
    const clearBtn = document.getElementById("aiCopilotClearBtn");
    const messagesEl = document.getElementById("aiCopilotMessages");
    const typingEl = document.getElementById("aiCopilotTyping");
    const form = document.getElementById("aiCopilotForm");
    const input = document.getElementById("aiCopilotInput");
    const sendBtn = document.getElementById("aiCopilotSendBtn");

    if (!toggleBtn || !drawer) return;

    async function aiApiFetch(url, options = {}) {

        const token = localStorage.getItem("token");

        const headers = {

            ...(options.headers || {}),

            Authorization: `Bearer ${token}`

        };

        return fetch(url, { ...options, headers });

    }

    let historyLoaded = false;
    let isSending = false;

    function renderMarkdown(text) {

        try {

            if (typeof marked !== "undefined" && typeof DOMPurify !== "undefined") {

                const raw = marked.parse(text, { breaks: true });

                return DOMPurify.sanitize(raw, {

                    ALLOWED_TAGS: [
                        "p", "br", "strong", "em", "ul", "ol", "li", "code", "pre",
                        "blockquote", "table", "thead", "tbody", "tr", "th", "td",
                        "h1", "h2", "h3", "h4", "a", "hr", "span"
                    ],

                    ALLOWED_ATTR: ["href", "class"]

                });

            }

        } catch (err) {

            console.error("Markdown render failed:", err);

        }

        // Fallback: escape and preserve line breaks
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML.replace(/\n/g, "<br>");

    }

    function scrollToBottom() {

        messagesEl.scrollTop = messagesEl.scrollHeight;

    }

    function addMessage(role, text) {

        const bubble = document.createElement("div");

        bubble.className = `ai-msg ${role}`;

        bubble.innerHTML = renderMarkdown(text);

        messagesEl.appendChild(bubble);

        scrollToBottom();

        return bubble;

    }

    function addToolBadge(toolName) {

        const badge = document.createElement("div");

        badge.className = "ai-tool-badge";

        badge.innerHTML =
            `<i class="fa-solid fa-gear fa-spin"></i> Running <strong>${escapeHtml(toolName)}</strong>...`;

        messagesEl.appendChild(badge);

        scrollToBottom();

    }

    function escapeHtml(str) {

        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;

    }

    function addConfirmCard(actionToken, summary) {

        const card = document.createElement("div");

        card.className = "ai-confirm-card";

        card.innerHTML = `
            <div class="ai-confirm-title">
                <i class="fa-solid fa-triangle-exclamation"></i>
                Confirmation needed
            </div>
            <p>${renderMarkdown(summary)}</p>
            <div class="ai-confirm-actions">
                <button type="button" class="ai-confirm-cancel">Cancel</button>
                <button type="button" class="ai-confirm-approve">Approve</button>
            </div>
        `;

        messagesEl.appendChild(card);

        scrollToBottom();

        const approveBtn = card.querySelector(".ai-confirm-approve");
        const cancelBtn = card.querySelector(".ai-confirm-cancel");

        approveBtn.addEventListener("click", async () => {

            approveBtn.disabled = true;
            cancelBtn.disabled = true;
            approveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;

            try {

                const response = await aiApiFetch("/api/ai/confirm", {

                    method: "POST",

                    headers: { "Content-Type": "application/json" },

                    body: JSON.stringify({ actionToken })

                });

                const data = await response.json();

                card.classList.add("resolved");

                if (data.success) {

                    addMessage("assistant", "✅ Done.");

                } else {

                    addMessage("error", `❌ ${data.message || "That action failed."}`);

                }

            } catch (err) {

                card.classList.add("resolved");

                addMessage("error", "❌ Could not reach the server to confirm this action.");

            }

        });

        cancelBtn.addEventListener("click", async () => {

            card.classList.add("resolved");

            try {

                await aiApiFetch("/api/ai/cancel", {

                    method: "POST",

                    headers: { "Content-Type": "application/json" },

                    body: JSON.stringify({ actionToken })

                });

            } catch (err) {

                // Non-critical — the token will simply expire server-side.

            }

            addMessage("assistant", "Okay, cancelled.");

        });

    }

    function openDrawer() {

        overlay.classList.add("show");

        drawer.classList.add("show");

        if (!historyLoaded) {

            loadHistory();

        }

        setTimeout(() => input.focus(), 200);

    }

    function closeDrawer() {

        overlay.classList.remove("show");

        drawer.classList.remove("show");

    }

    toggleBtn.addEventListener("click", openDrawer);
    closeBtn.addEventListener("click", closeDrawer);
    overlay.addEventListener("click", closeDrawer);

    async function loadHistory() {

        historyLoaded = true;

        try {

            const response = await aiApiFetch("/api/ai/history");

            const data = await response.json();

            if (data.success && data.messages.length) {

                const welcome = messagesEl.querySelector(".ai-copilot-welcome");

                if (welcome) welcome.remove();

                data.messages.forEach(m => {

                    if (m.role === "user" || m.role === "assistant") {

                        addMessage(m.role, m.content);

                    }

                });

            }

        } catch (err) {

            console.error("Failed to load AI history:", err);

        }

    }

    if (clearBtn) {

        clearBtn.addEventListener("click", async () => {

            try {

                await aiApiFetch("/api/ai/clear", { method: "POST" });

            } catch (err) {}

            messagesEl.innerHTML = `
                <div class="ai-copilot-welcome">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                    <h4>Ask me anything about your panel</h4>
                    <p>I can search logs, licenses and devices, explain stats, and (with your confirmation) ban devices or create keys.</p>
                    <div class="ai-copilot-suggestions">
                        <button type="button" class="ai-suggestion">Show today's dashboard stats</button>
                        <button type="button" class="ai-suggestion">Find failed logins in the last hour</button>
                        <button type="button" class="ai-suggestion">Is any device with a lot of failed attempts suspicious?</button>
                    </div>
                </div>
            `;

            wireSuggestions();

        });

    }

    function wireSuggestions() {

        messagesEl.querySelectorAll(".ai-suggestion").forEach(btn => {

            btn.addEventListener("click", () => {

                input.value = btn.textContent;
                sendMessage();

            });

        });

    }

    wireSuggestions();

    input.addEventListener("input", () => {

        input.style.height = "auto";
        input.style.height = Math.min(120, input.scrollHeight) + "px";

    });

    input.addEventListener("keydown", (e) => {

        if (e.key === "Enter" && !e.shiftKey) {

            e.preventDefault();
            sendMessage();

        }

    });

    form.addEventListener("submit", (e) => {

        e.preventDefault();
        sendMessage();

    });

    async function sendMessage() {

        const message = input.value.trim();

        if (!message || isSending) return;

        const welcome = messagesEl.querySelector(".ai-copilot-welcome");
        if (welcome) welcome.remove();

        addMessage("user", message);

        input.value = "";
        input.style.height = "auto";

        isSending = true;
        sendBtn.disabled = true;
        typingEl.style.display = "flex";

        let assistantBubble = null;
        let assistantText = "";

        try {

            const token = localStorage.getItem("token");

            const response = await fetch("/api/ai/chat", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },

                body: JSON.stringify({ message })

            });

            if (!response.ok || !response.body) {

                throw new Error("Failed to reach the AI Copilot.");

            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let buffer = "";

            while (true) {

                const { done, value } = await reader.read();

                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split("\n");

                buffer = lines.pop();

                for (const line of lines) {

                    if (!line.trim()) continue;

                    let event;

                    try {
                        event = JSON.parse(line);
                    } catch (err) {
                        continue;
                    }

                    if (event.type === "token") {

                        typingEl.style.display = "none";

                        if (!assistantBubble) {

                            assistantBubble = addMessage("assistant", "");

                        }

                        assistantText += event.text;

                        assistantBubble.innerHTML = renderMarkdown(assistantText);

                        scrollToBottom();

                    } else if (event.type === "tool_running") {

                        addToolBadge(event.tool);

                    } else if (event.type === "confirm_required") {

                        typingEl.style.display = "none";

                        addConfirmCard(event.actionToken, event.summary);

                    } else if (event.type === "error") {

                        typingEl.style.display = "none";

                        addMessage("error", event.message || "Something went wrong.");

                    }

                }

            }

        } catch (err) {

            console.error(err);

            addMessage("error", "Could not reach the AI Copilot. Please try again.");

        } finally {

            typingEl.style.display = "none";
            isSending = false;
            sendBtn.disabled = false;

        }

    }

})();
