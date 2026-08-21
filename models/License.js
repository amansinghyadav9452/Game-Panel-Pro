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

    // Application identity. A license is valid only for this Game ID.
    // Existing admin keys retain the legacy default "PUBG" until their
    // application is explicitly migrated.
    gameId: {
        type: String,
        required: true,
        default: "PUBG",
        trim: true,
        uppercase: true,
        index: true
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

    lastUsed: {
    type: Date,
    default: null
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

    failedAttempts: {
        type: Number,
        default: 0
    },

    lastFailedAt: {
        type: Date,
        default: null
    },

    banReason: {
        type: String,
        default: ""
    },

    createdBy: {
        type: String,
        default: "admin"
    },

}, {
    timestamps: true
});

// Speeds up: type-filtered lists (listLicenses), status/expiry sync queries,
// the expired-license cleanup job, and "recent first" sorting.
licenseSchema.index({ type: 1, status: 1 });
licenseSchema.index({ gameId: 1, type: 1, key: 1 });
licenseSchema.index({ status: 1, expiry: 1 });
licenseSchema.index({ createdAt: -1 });

module.exports = mongoose.model("License", licenseSchema);