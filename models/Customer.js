const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({

    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },

    password: {
        type: String,
        required: true
    },

    referralCode: {
        type: String,
        required: true
    },

    // Immutable application identity assigned automatically at signup.
    gameId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true
    },

    // Copied from the ReferralCode at signup time - this IS the
    // customer's access-until date. Once it passes, login and key
    // verification both stop working for this account.
    expiryAt: {
        type: Date,
        required: true
    },

    // Admin can hard-disable a customer manually (independent of
    // expiry) without touching their data.
    status: {
        type: String,
        enum: ["active", "disabled"],
        default: "active"
    },

    sessionVersion: {
        type: Number,
        default: 0
    },

    lastLoginAt: {
        type: Date,
        default: null
    },

    failedAttempts: {
        type: Number,
        default: 0
    },

    lockUntil: {
        type: Date,
        default: null
    }

}, {
    timestamps: true
});

customerSchema.index({ expiryAt: 1 });

module.exports = mongoose.model("Customer", customerSchema);
