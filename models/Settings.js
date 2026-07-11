const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({

    turnstile: {
        type: Boolean,
        default: true
    },

    sessionTimeout: {
        type: Number,
        default: 15
    },

    loginLock: {
        type: Boolean,
        default: true
    },

    publicExpiry: {
        type: Number,
        default: 30
    },

    premiumExpiry: {
        type: Number,
        default: 30
    },

    maxDevices: {
        type: Number,
        default: 1
    },

    maintenance: {
        type: Boolean,
        default: false
    },

    darkMode: {
        type: Boolean,
        default: true
    },

    telegramAlerts: {
        type: Boolean,
        default: false
    },

    discordWebhook: {
        type: Boolean,
        default: false
    },

    emailAlerts: {
        type: Boolean,
        default: false
    }

},{
    timestamps:true
});

module.exports =
mongoose.model("Settings",settingsSchema);