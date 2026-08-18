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

                const history = await ChatMessage.find({})
                    .sort({ createdAt: -1 })
                    .limit(HISTORY_LIMIT)
                    .lean();

                socket.emit("chat:history", history.reverse());

                const readField =
                    socket.role === "admin" ? "readByAdmin" : "readByDeveloper";

                const otherSender =
                    socket.role === "admin" ? "developer" : "admin";

                const now = new Date();

                const toMark = await ChatMessage.find({
                    sender: otherSender,
                    [readField]: false
                }).select("_id").lean();

                if (toMark.length > 0) {

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
