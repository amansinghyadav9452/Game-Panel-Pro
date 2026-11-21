const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  chatId: { type: String, required: true, index: true },
  chatTitle: { type: String, default: '' },
  messageId: { type: Number, required: true },
  userId: { type: String, default: '', index: true },
  username: { type: String, default: '' },
  displayName: { type: String, default: '' },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 14 }
}, { versionKey: false });
schema.index({ chatId: 1, createdAt: -1 });
module.exports = mongoose.models.TelegramAIMessage || mongoose.model('TelegramAIMessage', schema);
