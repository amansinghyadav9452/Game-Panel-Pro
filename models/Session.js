const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({

    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        required: true,
        index: true
    },

    sessionId: {
        type: String,
        required: true,
        unique: true
    },

    userAgent: {
        type: String,
        default: ""
    },

    deviceLabel: {
        type: String,
        default: "Unknown device"
    },

    ip: {
        type: String,
        default: ""
    },

    createdAt: {
        type: Date,
        default: Date.now
    },

    lastActiveAt: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("Session", sessionSchema);
