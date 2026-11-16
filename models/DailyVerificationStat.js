const mongoose = require("mongoose");

const dailyVerificationStatSchema = new mongoose.Schema({
    dayKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    ownerKey: { type: String, required: true }, // admin | customer:<ObjectId> | unattributed
    ownerType: { type: String, enum: ["admin", "customer", "unattributed"], required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    gameId: { type: String, default: "" },
    requestCount: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

dailyVerificationStatSchema.index({ dayKey: 1, ownerKey: 1 }, { unique: true });

module.exports = mongoose.model("DailyVerificationStat", dailyVerificationStatSchema);
