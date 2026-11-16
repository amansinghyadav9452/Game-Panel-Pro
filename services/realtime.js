let ioInstance = null;

function setRealtimeServer(io) {
    ioInstance = io;
}

function emitVerificationRequest(ownerType, customerId) {
    if (!ioInstance) return;
    const room = ownerType === "customer" && customerId
        ? `customer:${String(customerId)}`
        : ownerType === "admin" ? "admin" : null;
    if (room) ioInstance.to(room).emit("verification:request", { at: Date.now() });
}

module.exports = { setRealtimeServer, emitVerificationRequest };
