const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const ChatMessage = require("../models/ChatMessage");

const HISTORY_LIMIT = 100;

function registerDevChat(io) {

    const nsp = io.of("/dev-chat");

    // Handshake auth: admins prove identity with the same JWT the panel
    // already uses; the developer proves identity with a shared secret
    // (DEV_CHAT_KEY env var) since they don't have an admin login.
    nsp.use(async (socket, next) => {

        try {

            const { role, token, key } = socket.handshake.auth || {};

            if (role === "admin") {

                if (!token) {
                    return next(new Error("Unauthorized"));
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);

                const admin = await Admin.findById(decoded.id);

                if (!admin || decoded.sessionVersion !== admin.sessionVersion) {
                    return next(new Error("Unauthorized"));
                }

                socket.role = "admin";
                socket.senderLabel = admin.username;

                return next();

            }

            if (role === "developer") {

                if (!process.env.DEV_CHAT_KEY || key !== process.env.DEV_CHAT_KEY) {
                    return next(new Error("Unauthorized"));
                }

                socket.role = "developer";
                socket.senderLabel = "Developer";

                return next();

            }

            return next(new Error("Unauthorized"));

        }

        catch (error) {

            return next(new Error("Unauthorized"));

        }

    });

    nsp.on("connection", (socket) => {

        socket.join(socket.role);

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

                const unreadResult = await ChatMessage.updateMany(
                    { sender: otherSender, [readField]: false },
                    { $set: { [readField]: true } }
                );

                if (unreadResult.modifiedCount > 0) {

                    nsp.to(otherSender).emit("chat:read", { by: socket.role });

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

        socket.on("chat:typing", () => {

            socket.to(socket.role === "admin" ? "developer" : "admin")
                .emit("chat:typing", { from: socket.role });

        });

    });

}

module.exports = registerDevChat;
