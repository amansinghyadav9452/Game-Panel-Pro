const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  chatId: { type: String, required: true, index: true },
  scope: { type: String, enum: ['group', 'member'], required: true },
  userId: { type: String, default: '' },
  memory: { type: String, required: true, maxlength: 500 },
  source: { type: String, default: 'observed' },
  approved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });
schema.index({ chatId: 1, scope: 1, userId: 1, approved: 1 });
module.exports = mongoose.models.TelegramAIMemory || mongoose.model('TelegramAIMemory', schema);
