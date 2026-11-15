const mongoose = require("mongoose");

const dailyVerificationStatSchema = new mongoose.Schema({
    dayKey: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    requestCount: { type: Number, default: 0, min: 0 }
}, { timestamps: true });


module.exports = mongoose.model("DailyVerificationStat", dailyVerificationStatSchema);
