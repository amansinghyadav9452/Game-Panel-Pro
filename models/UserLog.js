const mongoose = require("mongoose");

const userLogSchema = new mongoose.Schema({
    licenseKey: String,

    licenseType: {
        type: String,
        enum: ["public", "premium"]
    },

    deviceModel: String,

    deviceMarketingName: String,

    deviceBrand: String,

    androidVersion: String,

    appVersion: String,

    playerName: String,

    serial: String,

    ip: String,

    status: {
        type: String,
        enum: ["success", "failed"]
    },

    reason: String

}, {
    timestamps: true
});

// /logs/recent filters by createdAt range + sorts by it (compound index
// covers both). /logs/export filters by status.
userLogSchema.index({ createdAt: -1 });
userLogSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("UserLog", userLogSchema);