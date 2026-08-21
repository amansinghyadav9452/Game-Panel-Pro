const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Customer = require("../models/Customer");
const ChatMessage = require("../models/ChatMessage");

const HISTORY_LIMIT = 100;

function customerRoom(customerId) {
    return `customer:${customerId}`;
}

function registerDevChat(io) {

    const nsp = io.of("/dev-chat");

    // Kitne sockets har role ke currently connected hain - isi se
    // online/offline presence decide hoti hai (multiple tabs/devices
    // se login hone par bhi "online" ek hi baar dikhta hai, jab tak
    // last socket disconnect na ho). Customers is admin<->developer
    // presence system ka hissa nahi hain.
    const onlineSockets = {
        admin: new Set(),
        developer: new Set()
    };

    function isOnline(role) {
        return onlineSockets[role].size > 0;
    }

    // Handshake auth: admin + developer apne Admin-login JWT se, aur
    // customer apne alag Customer-login JWT (scope:"customer") se
    // authenticate hote hain. Dono hi same JWT_SECRET use karte hain,
    // bas payload shape/scope alag hota hai.
    nsp.use(async (socket, next) => {

        try {

            const { token } = socket.handshake.auth || {};

            if (!token) {
                return next(new Error("Unauthorized"));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (decoded.scope === "customer") {

                const customer = await Customer.findById(decoded.id);

                if (!customer || decoded.sessionVersion !== customer.sessionVersion) {
                    return next(new Error("Unauthorized"));
                }

                if (customer.status === "disabled" || customer.expiryAt <= new Date()) {
                    return next(new Error("Unauthorized"));
                }

                socket.role = "customer";
                socket.customerId = customer._id.toString();
                socket.chatClearedAt = null;
                socket.senderLabel = customer.username;

                return next();

            }

            const admin = await Admin.findById(decoded.id);

            if (!admin || decoded.sessionVersion !== admin.sessionVersion) {
                return next(new Error("Unauthorized"));
            }

            if (admin.role !== "admin" && admin.role !== "developer") {
                return next(new Error("Unauthorized"));
            }

            socket.role = admin.role;
            socket.adminId = admin._id;
            socket.chatClearedAt = admin.chatClearedAt || null;
            socket.senderLabel =
                admin.role === "developer"
                    ? "Developer"
                    : (admin.displayName || admin.username);

            return next();

        }

        catch (error) {

            return next(new Error("Unauthorized"));

        }

    });

    // Developer ke liye "Admin" thread + har customer ki apni thread
    // ki list build karta hai (naam, latest message, unread count) -
    // isi se developer side pe pata chalta hai ki konsa msg kis
    // customer ka hai.
    async function buildConversationsList(developerSocket) {

        const clearedAt = developerSocket.chatClearedAt;
        const baseMatch = clearedAt ? { createdAt: { $gt: clearedAt } } : {};

        const adminUnread = await ChatMessage.countDocuments({
            ...baseMatch,
            customerId: null,
            sender: { $ne: "developer" },
            readByDeveloper: false
        });

        const adminLast = await ChatMessage.findOne({ ...baseMatch, customerId: null })
            .sort({ createdAt: -1 })
            .lean();

        const conversations = [{
            id: null,
            label: "Admin",
            lastText: adminLast ? (adminLast.unsent ? "Message unsent" : adminLast.text) : "",
            lastAt: adminLast ? adminLast.createdAt : null,
            unread: adminUnread
        }];

        const customerIds = await ChatMessage.distinct("customerId", {
            ...baseMatch,
            customerId: { $ne: null }
        });

        if (customerIds.length) {

            const customers = await Customer.find({ _id: { $in: customerIds } })
                .select("username")
                .lean();

            const nameById = new Map(customers.map(c => [c._id.toString(), c.username]));

            for (const id of customerIds) {

                const idStr = id.toString();

                const [unread, last] = await Promise.all([

                    ChatMessage.countDocuments({
                        ...baseMatch,
                        customerId: id,
                        sender: "customer",
                        readByDeveloper: false
                    }),

                    ChatMessage.findOne({ ...baseMatch, customerId: id })
                        .sort({ createdAt: -1 })
                        .lean()

                ]);

                conversations.push({
                    id: idStr,
                    label: nameById.get(idStr) || "Unknown customer",
                    lastText: last ? (last.unsent ? "Message unsent" : last.text) : "",
                    lastAt: last ? last.createdAt : null,
                    unread
                });

            }

        }

        conversations.sort((a, b) => {
            if (a.id === null) return -1;
            if (b.id === null) return 1;
            return new Date(b.lastAt || 0) - new Date(a.lastAt || 0);
        });

        return conversations;

    }

    async function sendConversationsToDeveloper(socket) {

        try {

            const conversations = await buildConversationsList(socket);
            socket.emit("chat:conversations", conversations);

        }

        catch (error) {

            console.error("dev-chat conversations error:", error.message);

        }

    }

    async function refreshDeveloperConversations() {

        for (const id of onlineSockets.developer) {

            const socket = nsp.sockets.get(id);

            if (socket) sendConversationsToDeveloper(socket);

        }

    }

    async function loadHistory(query, chatClearedAt) {

        const finalQuery = { ...query };

        if (chatClearedAt) {
            finalQuery.createdAt = { $gt: chatClearedAt };
        }

        const history = await ChatMessage.find(finalQuery)
            .sort({ createdAt: -1 })
            .limit(HISTORY_LIMIT)
            .lean();

        return history.reverse();

    }

    nsp.on("connection", (socket) => {

        if (socket.role === "customer") {
            socket.join(customerRoom(socket.customerId));
        } else {
            socket.join(socket.role);
        }

        if (socket.role === "admin" || socket.role === "developer") {

            const otherRole = socket.role === "admin" ? "developer" : "admin";

            const wasOtherOnlineBefore = isOnline(socket.role);

            onlineSockets[socket.role].add(socket.id);

            // Pehli connection is role ki - doosre role ko batao ki ye
            // online ho gaya.
            if (!wasOtherOnlineBefore) {

                nsp.to(otherRole).emit("presence:update", {
                    role: socket.role,
                    online: true
                });

            }

            // Naye socket ko turant doosre role ka current status bhejo.
            socket.emit("presence:update", {
                role: otherRole,
                online: isOnline(otherRole)
            });

        } else {

            // Customer ko developer online hai ya nahi bata do (admin
            // presence customer ke liye irrelevant hai, unka thread
            // sirf developer ke saath hota hai).
            socket.emit("presence:update", {
                role: "developer",
                online: isOnline("developer")
            });

        }

        (async () => {

            try {

                if (socket.role === "customer") {

                    const history = await loadHistory(
                        { customerId: socket.customerId },
                        socket.chatClearedAt
                    );

                    socket.emit("chat:history", history);

                } else if (socket.role === "developer") {

                    // Developer default view: Admin thread (customerId
                    // null), plus the conversation list so they can
                    // switch to any customer's thread.
                    const history = await loadHistory(
                        { customerId: null },
                        socket.chatClearedAt
                    );

                    socket.emit("chat:history", history);

                    sendConversationsToDeveloper(socket);

                } else {

                    // Admin ki apni ek hi thread hoti hai - developer ke
                    // saath, customerId hamesha null.
                    const history = await loadHistory(
                        { customerId: null },
                        socket.chatClearedAt
                    );

                    socket.emit("chat:history", history);

                }

                // NOTE: Messages are intentionally NOT auto-marked as
                // seen here anymore. This connection fires on every
                // page load across the whole panel (the chat widget is
                // global), so marking everything "seen" the instant the
                // socket connects — even though the chat panel was
                // never opened — was silently clearing the unread
                // badge before the user ever saw the message. Seen
                // status is only updated via the explicit
                // "chat:mark-seen" event, which the client sends when
                // the chat panel is actually opened.

            }

            catch (error) {

                console.error("dev-chat init error:", error.message);

            }

        })();

        socket.on("chat:message", async (payload) => {

            try {

                const text = (payload?.text || "").toString().trim().slice(0, 2000);

                if (!text) return;

                if (socket.role === "customer") {

                    const message = await ChatMessage.create({

                        sender: "customer",
                        senderLabel: socket.senderLabel,
                        customerId: socket.customerId,
                        text,
                        readByDeveloper: false

                    });

                    nsp.to(customerRoom(socket.customerId)).to("developer").emit("chat:message", message);

                    refreshDeveloperConversations();

                    return;

                }

                if (socket.role === "developer") {

                    // Developer bhejte waqt batata hai kis thread me bhej
                    // raha hai - null/absent = Admin thread, warna us
                    // customer ki thread.
                    const targetCustomerId = payload?.customerId ? String(payload.customerId) : null;

                    const message = await ChatMessage.create({

                        sender: "developer",
                        senderLabel: socket.senderLabel,
                        customerId: targetCustomerId,
                        text,
                        readByDeveloper: true

                    });

                    if (targetCustomerId) {
                        nsp.to(customerRoom(targetCustomerId)).to("developer").emit("chat:message", message);
                        refreshDeveloperConversations();
                    } else {
                        nsp.to("admin").to("developer").emit("chat:message", message);
                    }

                    return;

                }

                // Admin -> its own thread with the developer only.
                const message = await ChatMessage.create({

                    sender: "admin",
                    senderLabel: socket.senderLabel,
                    customerId: null,
                    text,
                    readByAdmin: true

                });

                nsp.to("admin").to("developer").emit("chat:message", message);

            }

            catch (error) {

                console.error("dev-chat message error:", error.message);

            }

        });

        // Developer ke conversation-switcher se chalta hai - specific
        // thread (Admin ya kisi customer) ki history dobara bhejta hai.
        socket.on("chat:switch-conversation", async (payload) => {

            try {

                if (socket.role !== "developer") return;

                const customerId = payload?.customerId ? String(payload.customerId) : null;

                const history = await loadHistory(
                    { customerId },
                    socket.chatClearedAt
                );

                socket.emit("chat:conversation-history", { customerId, history });

            }

            catch (error) {

                console.error("dev-chat switch-conversation error:", error.message);

            }

        });

        // Recipient panel open karke bhejta hai jab msgs dekh raha ho
        // (already-unread msgs to connection time hi mark ho jaate
        // hain; ye tab kaam aata hai jab dono online ho aur naya msg
        // turant dikh raha ho).
        socket.on("chat:mark-seen", async (payload) => {

            try {

                if (socket.role === "customer") {

                    const now = new Date();

                    const toMark = await ChatMessage.find({
                        customerId: socket.customerId,
                        sender: { $ne: "customer" },
                        readByCustomer: false
                    }).select("_id").lean();

                    if (toMark.length === 0) return;

                    const ids = toMark.map((m) => m._id);

                    await ChatMessage.updateMany(
                        { _id: { $in: ids } },
                        { $set: { readByCustomer: true, seenAt: now } }
                    );

                    nsp.to("developer").emit("chat:seen", {
                        by: "customer",
                        customerId: socket.customerId,
                        at: now,
                        messageIds: ids.map((id) => id.toString())
                    });

                    return;

                }

                if (socket.role === "developer") {

                    const customerId = payload?.customerId ? String(payload.customerId) : null;

                    const now = new Date();

                    const toMark = await ChatMessage.find({
                        customerId,
                        sender: { $ne: "developer" },
                        readByDeveloper: false
                    }).select("_id").lean();

                    if (toMark.length === 0) return;

                    const ids = toMark.map((m) => m._id);

                    await ChatMessage.updateMany(
                        { _id: { $in: ids } },
                        { $set: { readByDeveloper: true, seenAt: now } }
                    );

                    if (customerId) {
                        nsp.to(customerRoom(customerId)).emit("chat:seen", {
                            by: "developer",
                            at: now,
                            messageIds: ids.map((id) => id.toString())
                        });
                    } else {
                        nsp.to("admin").emit("chat:seen", {
                            by: "developer",
                            at: now,
                            messageIds: ids.map((id) => id.toString())
                        });
                    }

                    refreshDeveloperConversations();

                    return;

                }

                // Admin marking the (only) thread with the developer as seen.
                const now = new Date();

                const toMark = await ChatMessage.find({
                    customerId: null,
                    sender: "developer",
                    readByAdmin: false
                }).select("_id").lean();

                if (toMark.length === 0) return;

                const ids = toMark.map((m) => m._id);

                await ChatMessage.updateMany(
                    { _id: { $in: ids } },
                    { $set: { readByAdmin: true, seenAt: now } }
                );

                nsp.to("developer").emit("chat:seen", {
                    by: "admin",
                    at: now,
                    messageIds: ids.map((id) => id.toString())
                });

            }

            catch (error) {

                console.error("dev-chat mark-seen error:", error.message);

            }

        });

        // Unsend - sirf apne bheje hue message ko. Text DB me rehta hai
        // (delete nahi hota) taaki doosre role ko pata rahe ki kya
        // unsend hua tha, jaisa maanga gaya tha.
        socket.on("chat:delete", async (payload) => {

            try {

                const messageId = payload?.messageId;

                if (!messageId) return;

                const message = await ChatMessage.findById(messageId);

                if (!message || message.sender !== socket.role) {
                    return;
                }

                if (socket.role === "customer" &&
                    String(message.customerId) !== String(socket.customerId)) {
                    return;
                }

                if (message.unsent) return;

                message.unsent = true;
                message.unsentAt = new Date();

                await message.save();

                const eventPayload = {
                    messageId: message._id.toString(),
                    unsentAt: message.unsentAt,
                    unsentBy: socket.role
                };

                if (message.customerId) {
                    nsp.to(customerRoom(message.customerId)).to("developer").emit("chat:unsent", eventPayload);
                } else {
                    nsp.to("admin").to("developer").emit("chat:unsent", eventPayload);
                }

            }

            catch (error) {

                console.error("dev-chat delete error:", error.message);

            }

        });

        socket.on("chat:typing", (payload) => {

            if (socket.role === "customer") {

                socket.to("developer").emit("chat:typing", {
                    from: "customer",
                    customerId: socket.customerId
                });

            } else if (socket.role === "developer") {

                const customerId = payload?.customerId ? String(payload.customerId) : null;

                if (customerId) {
                    socket.to(customerRoom(customerId)).emit("chat:typing", { from: "developer" });
                } else {
                    socket.to("admin").emit("chat:typing", { from: "developer" });
                }

            } else {

                socket.to("developer").emit("chat:typing", { from: "admin" });

            }

        });

        // "Delete for me" - sirf is account ki apni view khaali ho
        // jaati hai. Dusre role ko kuch farak nahi padta, unhe saare
        // messages waise hi dikhte rehte hain. Hum actual messages
        // delete nahi karte, bas is account ke liye ek cutoff
        // timestamp save kar dete hain aur history fetch usी se filter
        // hoti hai (upar dekho). Developer ke liye ye cutoff unki saari
        // threads (Admin + har customer) pe ek saath lagta hai.
        socket.on("chat:clear-for-me", async () => {

            try {

                const now = new Date();

                if (socket.role === "customer") {

                    // Customers ka apna chatClearedAt persist nahi hota
                    // (Customer model me field nahi hai) - unki har
                    // connection pe history taazi milti hai, isliye bas
                    // is socket ki local view clear karke confirm kar do.
                    socket.chatClearedAt = now;
                    socket.emit("chat:cleared", { scope: "me" });
                    return;

                }

                await Admin.findByIdAndUpdate(socket.adminId, {
                    chatClearedAt: now
                });

                socket.chatClearedAt = now;

                socket.emit("chat:cleared", { scope: "me" });

            }

            catch (error) {

                console.error("dev-chat clear-for-me error:", error.message);

            }

        });

        // "Delete for everyone" - sirf CURRENT thread (Admin ya ek
        // specific customer ki) dono taraf se hamesha ke liye delete
        // hoti hai, baaki threads untouched rehti hain.
        socket.on("chat:clear-for-everyone", async (payload) => {

            try {

                let customerId = null;

                if (socket.role === "customer") {
                    customerId = socket.customerId;
                } else if (socket.role === "developer") {
                    customerId = payload?.customerId ? String(payload.customerId) : null;
                }

                await ChatMessage.deleteMany({ customerId });

                if (customerId) {

                    nsp.to(customerRoom(customerId)).to("developer")
                        .emit("chat:cleared", { scope: "everyone", by: socket.role, customerId });

                    refreshDeveloperConversations();

                } else {

                    nsp.to("admin").to("developer")
                        .emit("chat:cleared", { scope: "everyone", by: socket.role, customerId: null });

                    await Admin.updateMany({}, { chatClearedAt: null });

                }

            }

            catch (error) {

                console.error("dev-chat clear-for-everyone error:", error.message);

            }

        });

        socket.on("disconnect", () => {

            if (socket.role === "admin" || socket.role === "developer") {

                onlineSockets[socket.role].delete(socket.id);

                const otherRole = socket.role === "admin" ? "developer" : "admin";

                if (!isOnline(socket.role)) {

                    nsp.to(otherRole).emit("presence:update", {
                        role: socket.role,
                        online: false
                    });

                }

            }

        });

    });

}

module.exports = registerDevChat;
