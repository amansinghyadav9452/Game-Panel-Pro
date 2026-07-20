const mongoose = require("mongoose");

const userLogSchema = new mongoose.Schema({
    licenseKey: String,

    licenseType: {
        type: String,
        enum: ["public", "premium"]
    },

    deviceModel: String,

    deviceBrand: String,

    androidVersion: String,

    serial: String,

    status: {
        type: String,
        enum: ["success", "failed"]
    },

    reason: String

}, {
    timestamps: true
});

module.exports = mongoose.model("UserLog", userLogSchema);