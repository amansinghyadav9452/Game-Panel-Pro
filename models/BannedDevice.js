const mongoose = require("mongoose");

const bannedDeviceSchema = new mongoose.Schema({

    serial: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    userKey: {
        type: String,
        default: ""
    },

    deviceBrand: {
        type: String,
        default: ""
    },

    deviceModel: {
        type: String,
        default: ""
    },

    androidVersion: {
        type: String,
        default: ""
    },

    appVersion: {
        type: String,
        default: ""
    },

    playerName: {
        type: String,
        default: ""
    },

    bannedBy: {
        type: String,
        default: "Admin"
    },

    reason: {
        type: String,
        default: ""
    },

    bannedAt: {
        type: Date,
        default: Date.now
    }

});

// The list route always sorts by bannedAt desc.
bannedDeviceSchema.index({ bannedAt: -1 });

module.exports = mongoose.model(
    "BannedDevice",
    bannedDeviceSchema
);