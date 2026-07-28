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

module.exports = mongoose.model("UserLog", userLogSchema);