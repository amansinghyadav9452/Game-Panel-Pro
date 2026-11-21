const express = require("express");
const auth = require("../middleware/auth");
const TelegramModerationLog = require("../models/TelegramModerationLog");
const service = require("../services/telegramModeration");
const telegramAI = require("../services/telegramAI");
const router = express.Router();

router.get("/status", auth, (req, res) => res.json({ success: true, ...service.status(), ai: telegramAI.status() }));

router.get("/ai-status", auth, (req, res) => res.json({ success: true, ...telegramAI.status() }));

router.post("/start", auth, async (req, res) => {
  try {
    const result = await service.start();
    res.json({ success: true, ...result, ...service.status() });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message, ...service.status() });
  }
});

router.post("/stop", auth, async (req, res) => {
  await service.stop();
  res.json({ success: true, ...service.status() });
});

router.get("/logs", auth, async (req, res) => {
  try {
    const page = Math.max(1, Math.min(1000, Number(req.query.page) || 1));
    const limit = 25;
    const [items, total] = await Promise.all([
      TelegramModerationLog.find().sort({ deletedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      TelegramModerationLog.countDocuments()
    ]);
    res.json({ success: true, items, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not load moderation logs." });
  }
});

module.exports = router;
