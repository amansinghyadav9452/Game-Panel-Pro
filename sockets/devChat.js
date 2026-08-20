const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const ChatMessage = require("../models/ChatMessage");

const HISTORY_LIMIT = 100;

function registerDevChat(io) {

    const nsp = io.of("/dev-chat");

    // Kitne sockets har role ke currently connected hain - isi se
    // online/offline presence decide hoti hai (multiple tabs/devices
    // se login hone par bhi "online" ek hi baar dikhta hai, jab tak
    // last socket disconnect na ho).
    const onlineSockets = {
        admin: new Set(),
        developer: new Set()
    };

    function isOnline(role) {
        return onlineSockets[role].size > 0;
    }

    // Handshake auth: ab dono roles (admin + developer) apne login se
    // mile JWT token se hi authenticate hote hain. Developer ka alag
    // login hota hai (Admin collection me role:"developer" wali entry),
    // isliye ab koi shared DEV_CHAT_KEY env var ki zaroorat nahi.
    nsp.use(async (socket, next) => {

        try {

            const { token } = socket.handshake.auth || {};

            if (!token) {
                return next(new Error("Unauthorized"));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

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

    nsp.on("connection", (socket) => {

        socket.join(socket.role);

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

        (async () => {

            try {

                // "Delete for me" ke baad us admin account ko purane
                // messages dikhna band ho jaate hain - unki apni
                // chatClearedAt se pehle wale messages history me hi
                // nahi bhejte.
                const query = {};

                if (socket.chatClearedAt) {
                    query.createdAt = { $gt: socket.chatClearedAt };
                }

                const history = await ChatMessage.find(query)
                    .sort({ createdAt: -1 })
                    .limit(HISTORY_LIMIT)
                    .lean();

                socket.emit("chat:history", history.reverse());

                // NOTE: Messages are intentionally NOT auto-marked as
                // seen here anymore. This connection fires on every
                // page load across the whole panel (the chat widget is
                // global), so marking everything "seen" the instant the
                // socket connects — even though the chat panel was
                // never opened — was silently clearing the unread
                // badge before the user ever saw the message. Seen
                // status is now only updated via the explicit
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

                const message = await ChatMessage.create({

                    sender: socket.role,
                    senderLabel: socket.senderLabel,
                    text,
                    readByAdmin: socket.role === "admin",
                    readByDeveloper: socket.role === "developer"

                });

                nsp.emit("chat:message", message);

            }

            catch (error) {

                console.error("dev-chat message error:", error.message);

            }

        });

        // Recipient panel open karke bhejta hai jab msgs dekh raha ho
        // (already-unread msgs to connection time hi mark ho jaate
        // hain; ye tab kaam aata hai jab dono online ho aur naya msg
        // turant dikh raha ho).
        socket.on("chat:mark-seen", async () => {

            try {

                const readField =
                    socket.role === "admin" ? "readByAdmin" : "readByDeveloper";

                const otherSender =
                    socket.role === "admin" ? "developer" : "admin";

                const now = new Date();

                const toMark = await ChatMessage.find({
                    sender: otherSender,
                    [readField]: false
                }).select("_id").lean();

                if (toMark.length === 0) return;

                const ids = toMark.map((m) => m._id);

                await ChatMessage.updateMany(
                    { _id: { $in: ids } },
                    { $set: { [readField]: true, seenAt: now } }
                );

                nsp.to(otherSender).emit("chat:seen", {
                    by: socket.role,
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

                if (message.unsent) return;

                message.unsent = true;
                message.unsentAt = new Date();

                await message.save();

                nsp.emit("chat:unsent", {
                    messageId: message._id.toString(),
                    unsentAt: message.unsentAt,
                    unsentBy: socket.role
                });

            }

            catch (error) {

                console.error("dev-chat delete error:", error.message);

            }

        });

        socket.on("chat:typing", () => {

            socket.to(socket.role === "admin" ? "developer" : "admin")
                .emit("chat:typing", { from: socket.role });

        });

        // "Delete for me" - sirf is account ki apni view khaali ho
        // jaati hai. Dusre role ko kuch farak nahi padta, unhe saare
        // messages waise hi dikhte rehte hain. Hum actual messages
        // delete nahi karte, bas is account ke liye ek cutoff
        // timestamp save kar dete hain aur history fetch usी se filter
        // hoti hai (upar dekho).
        socket.on("chat:clear-for-me", async () => {

            try {

                const now = new Date();

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

        // "Delete for everyone" - poori conversation dono taraf se
        // hamesha ke liye delete ho jaati hai (DB se hi remove).
        socket.on("chat:clear-for-everyone", async () => {

            try {

                await ChatMessage.deleteMany({});

                // Ab chatClearedAt ki bhi zaroorat nahi (kuch bacha hi
                // nahi), dono admin accounts ke liye reset kar do taaki
                // future messages phir se sahi tarike se history me
                // aayein.
                await Admin.updateMany({}, { chatClearedAt: null });

                nsp.emit("chat:cleared", { scope: "everyone", by: socket.role });

            }

            catch (error) {

                console.error("dev-chat clear-for-everyone error:", error.message);

            }

        });

        socket.on("disconnect", () => {

            onlineSockets[socket.role].delete(socket.id);

            if (!isOnline(socket.role)) {

                nsp.to(otherRole).emit("presence:update", {
                    role: socket.role,
                    online: false
                });

            }

        });

    });

}

module.exports = registerDevChat;
