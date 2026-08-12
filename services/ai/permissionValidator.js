const crypto = require("crypto");
const { isDestructive, toolExists } = require("./toolRegistry");

const ACTION_TTL_MS = 2 * 60 * 1000;

const pendingActions = new Map();

setInterval(() => {

    const now = Date.now();

    for (const [token, action] of pendingActions.entries()) {

        if (now - action.createdAt > ACTION_TTL_MS) {
            pendingActions.delete(token);
        }

    }

}, 60 * 1000).unref();

function validateToolRequest(name) {

    if (!toolExists(name)) {

        return { ok: false, reason: `Unknown tool: ${name}` };

    }

    return { ok: true };

}

function createPendingAction(adminId, tool, args) {

    const token = crypto.randomBytes(24).toString("hex");

    pendingActions.set(token, {

        adminId,
        tool,
        args,
        createdAt: Date.now()

    });

    return token;

}

function consumePendingAction(adminId, token) {

    const action = pendingActions.get(token);

    if (!action) {
        return { ok: false, reason: "This action has expired or was already used." };
    }

    pendingActions.delete(token);

    if (action.adminId !== adminId) {
        return { ok: false, reason: "This action does not belong to your session." };
    }

    if (Date.now() - action.createdAt > ACTION_TTL_MS) {
        return { ok: false, reason: "This action has expired. Please ask again." };
    }

    return { ok: true, tool: action.tool, args: action.args };

}

module.exports = {

    validateToolRequest,
    isDestructive,
    createPendingAction,
    consumePendingAction

};
