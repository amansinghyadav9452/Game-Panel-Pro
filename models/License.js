const mongoose = require("mongoose");

const licenseSchema = new mongoose.Schema({

    key: {
        type: String,
        required: true,
        unique: true
    },

    type: {
        type: String,
        enum: ["public", "premium"],
        required: true
    },

    status: {
        type: String,
        enum: ["active", "expired", "banned"],
        default: "active"
    },

    expiry: {
        type: Date,
        required: true
    },

    maxUses: {
        type: Number,
        default: 1
    },

    usedCount: {
        type: Number,
        default: 0
    },

    devices: [{
        type: String
    }],

    lastDevice: {
        type: String,
        default: null
    },

    createdBy: {
        type: String,
        default: "admin"
    },

    lastUsed: {
        type: Date,
        default: null
    },

}, {
    timestamps: true
});

module.exports = mongoose.model("License", licenseSchema);