const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  chatId: { type: String, required: true, index: true },
  chatTitle: { type: String, default: "" },
  messageId: { type: Number, required: true },
  userId: { type: String, default: "" },
  username: { type: String, default: "" },
  displayName: { type: String, default: "" },
  reason: { type: String, required: true },
  excerpt: { type: String, default: "" },
  deletedAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

schema.index({ chatId: 1, deletedAt: -1 });
module.exports = mongoose.models.TelegramModerationLog ||
  mongoose.model("TelegramModerationLog", schema);
