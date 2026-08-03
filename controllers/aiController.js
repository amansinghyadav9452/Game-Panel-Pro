const { chatCompletion } = require("../services/ai/aiService");
const { executeTool } = require("../services/ai/toolRegistry");
const {
    validateToolRequest,
    isDestructive,
    createPendingAction,
    consumePendingAction
} = require("../services/ai/permissionValidator");

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_TOOL_HOPS = 5;
const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 min

// Temporary, in-memory only - never persisted to the database.
// sessions: adminId -> { messages: [...], updatedAt }
const sessions = new Map();

setInterval(() => {

    const now = Date.now();

    for (const [id, session] of sessions.entries()) {

        if (now - session.updatedAt > SESSION_IDLE_MS) {
            sessions.delete(id);
        }

    }

}, 5 * 60 * 1000).unref();

function getSession(adminId) {

    let session = sessions.get(adminId);

    if (!session) {

        session = { messages: [], updatedAt: Date.now() };
        sessions.set(adminId, session);

    }

    return session;

}

function trimHistory(session) {

    if (session.messages.length > MAX_HISTORY_MESSAGES) {

        session.messages = session.messages.slice(-MAX_HISTORY_MESSAGES);

    }

}

function writeEvent(res, event) {

    res.write(JSON.stringify(event) + "\n");

}

async function pseudoStream(res, text) {

    const words = text.split(/(\s+)/);

    for (const word of words) {

        writeEvent(res, { type: "token", text: word });

        // Small delay for a natural typing feel without a second API call.
        await new Promise(r => setTimeout(r, 12));

    }

}

/**
 * POST /api/ai/chat
 * body: { message: string }
 * Streams newline-delimited JSON events: token | tool_running | confirm_required | error | done
 */
async function handleChat(req, res) {

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");

    const adminId = String(req.admin._id);
    const message = typeof req.body.message === "string" ? req.body.message.trim() : "";

    if (!message) {

        writeEvent(res, { type: "error", message: "Message cannot be empty." });
        return res.end();

    }

    if (message.length > MAX_MESSAGE_LENGTH) {

        writeEvent(res, { type: "error", message: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` });
        return res.end();

    }

    const session = getSession(adminId);

    session.messages.push({ role: "user", content: message });
    session.updatedAt = Date.now();

    try {

        let hops = 0;

        while (hops < MAX_TOOL_HOPS) {

            hops++;

            const assistantMessage = await chatCompletion(session.messages);

            const toolCalls = assistantMessage.tool_calls || [];

            if (!toolCalls.length) {

                const finalText = assistantMessage.content || "I don't have a response for that.";

                session.messages.push({ role: "assistant", content: finalText });
                trimHistory(session);
                session.updatedAt = Date.now();

                await pseudoStream(res, finalText);

                writeEvent(res, { type: "done" });

                return res.end();

            }

            // Record the assistant's tool-call request in history so the
            // API has correct context on the next hop.
            session.messages.push({

                role: "assistant",
                content: assistantMessage.content || null,
                tool_calls: toolCalls

            });

            let pausedForConfirmation = false;

            for (const call of toolCalls) {

                const name = call.function.name;

                let args = {};

                try {
                    args = JSON.parse(call.function.arguments || "{}");
                } catch (err) {
                    args = {};
                }

                const validation = validateToolRequest(name);

                if (!validation.ok) {

                    session.messages.push({
                        role: "tool",
                        tool_call_id: call.id,
                        content: JSON.stringify({ error: validation.reason })
                    });

                    continue;

                }

                if (isDestructive(name)) {

                    const token = createPendingAction(adminId, name, args);

                    writeEvent(res, {

                        type: "confirm_required",
                        actionToken: token,
                        tool: name,
                        args,
                        summary: describeAction(name, args)

                    });

                    // Remove the dangling tool_call from history since it
                    // has no result yet - we'll append the real exchange
                    // once/if the admin confirms via /api/ai/confirm.
                    session.messages.pop();

                    pausedForConfirmation = true;

                    break;

                }

                writeEvent(res, { type: "tool_running", tool: name });

                try {

                    const result = await executeTool(name, args, {
                        adminUsername: req.admin.username
                    });

                    session.messages.push({
                        role: "tool",
                        tool_call_id: call.id,
                        content: JSON.stringify(result).slice(0, 4000)
                    });

                } catch (toolErr) {

                    session.messages.push({
                        role: "tool",
                        tool_call_id: call.id,
                        content: JSON.stringify({ error: toolErr.message })
                    });

                }

            }

            if (pausedForConfirmation) {

                session.updatedAt = Date.now();
                return res.end();

            }

        }

        writeEvent(res, {
            type: "error",
            message: "I couldn't finish that in a reasonable number of steps. Please try rephrasing."
        });

        return res.end();

    } catch (err) {

        console.error("AI chat error:", err);

        writeEvent(res, { type: "error", message: err.message || "Something went wrong." });

        return res.end();

    }

}

function describeAction(tool, args) {

    switch (tool) {

        case "banDevice":
            return `Ban device \`${args.serial}\`${args.reason ? ` — reason: "${args.reason}"` : ""}`;

        case "unbanDevice":
            return `Unban device \`${args.serial}\``;

        case "createLicense":
            return `Create a new ${args.type || "public"} license key${args.key ? ` (\`${args.key}\`)` : " (auto-generated)"}`;

        default:
            return `Run ${tool}`;

    }

}

/**
 * POST /api/ai/confirm
 * body: { actionToken: string }
 * Executes a previously-proposed destructive action, but only if the
 * token is valid, unexpired, single-use, and belongs to this admin.
 */
async function handleConfirm(req, res) {

    const adminId = String(req.admin._id);
    const actionToken = typeof req.body.actionToken === "string" ? req.body.actionToken : "";

    if (!actionToken) {

        return res.status(400).json({ success: false, message: "Missing action token." });

    }

    const consumed = consumePendingAction(adminId, actionToken);

    if (!consumed.ok) {

        return res.status(400).json({ success: false, message: consumed.reason });

    }

    const session = getSession(adminId);

    try {

        const result = await executeTool(consumed.tool, consumed.args, {
            adminUsername: req.admin.username
        });

        session.messages.push({

            role: "assistant",
            content: `✅ Done — ${describeAction(consumed.tool, consumed.args)}.`

        });

        trimHistory(session);
        session.updatedAt = Date.now();

        return res.json({ success: true, result });

    } catch (err) {

        session.messages.push({

            role: "assistant",
            content: `❌ That action failed: ${err.message}`

        });

        session.updatedAt = Date.now();

        return res.status(400).json({ success: false, message: err.message });

    }

}

/**
 * POST /api/ai/cancel
 * body: { actionToken: string }
 * Discards a pending confirmation without running anything.
 */
async function handleCancel(req, res) {

    const adminId = String(req.admin._id);
    const actionToken = typeof req.body.actionToken === "string" ? req.body.actionToken : "";

    if (actionToken) {
        consumePendingAction(adminId, actionToken);
    }

    res.json({ success: true });

}

function handleHistory(req, res) {

    const adminId = String(req.admin._id);
    const session = sessions.get(adminId);

    res.json({

        success: true,

        messages: session
            ? session.messages
                .filter(m => m.role === "user" || (m.role === "assistant" && m.content))
                .map(m => ({ role: m.role, content: m.content }))
            : []

    });

}

function handleClear(req, res) {

    const adminId = String(req.admin._id);
    sessions.delete(adminId);

    res.json({ success: true });

}

module.exports = {

    handleChat,
    handleConfirm,
    handleCancel,
    handleHistory,
    handleClear

};
