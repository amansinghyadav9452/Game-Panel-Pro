const mongoose = require("mongoose");

const referralCodeSchema = new mongoose.Schema({

    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },

    // Admin-decided date. Two jobs: (1) deadline to redeem the code,
    // (2) once redeemed, this becomes the customer's access-until
    // date - the whole point of the referral system.
    expiryAt: {
        type: Date,
        required: true
    },

    status: {
        type: String,
        enum: ["active", "used", "revoked"],
        default: "active"
    },

    usedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        default: null
    },

    usedAt: {
        type: Date,
        default: null
    },

    createdBy: {
        type: String,
        default: "admin"
    },

    note: {
        type: String,
        default: ""
    }

}, {
    timestamps: true
});

referralCodeSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("ReferralCode", referralCodeSchema);
