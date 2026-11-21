const express = require("express");
const auth = require("../middleware/auth");
const TelegramModerationLog = require("../models/TelegramModerationLog");
const service = require("../services/telegramModeration");
const telegramAI = require("../services/telegramAI");
const router = express.Router();

router.get("/status", auth, async (req, res) => {
  await telegramAI.loadAdminProviderSettings();
  res.json({ success: true, ...service.status(), ai: telegramAI.status() });
});

router.get("/providers", auth, async (req, res) => {
  await telegramAI.loadAdminProviderSettings();
  res.json({ success: true, providers: telegramAI.status().providerCatalog, order: telegramAI.status().requestedProviderOrder });
});

router.put("/providers", auth, async (req, res) => {
  try {
    await telegramAI.loadAdminProviderSettings();
    const allowed = new Set(telegramAI.providerCatalog().map(item => item.id));
    const order = Array.isArray(req.body?.order) ? req.body.order.map(x => String(x).trim().toLowerCase()) : [];
    const disabled = Array.isArray(req.body?.disabled) ? req.body.disabled.map(x => String(x).trim().toLowerCase()) : [];
    if (!order.length || order.length > allowed.size || order.some(id => !allowed.has(id)) || new Set(order).size !== order.length) {
      return res.status(400).json({ success: false, message: "Select a valid provider order without duplicates." });
    }
    if (disabled.some(id => !allowed.has(id)) || new Set(disabled).size !== disabled.length) {
      return res.status(400).json({ success: false, message: "Invalid provider toggle selection." });
    }
    const enabledConfigured = order.filter(id => !disabled.includes(id) && telegramAI.providerCatalog().some(p => p.id === id && p.configured));
    if (!enabledConfigured.length) return res.status(400).json({ success: false, message: "Enable at least one provider with a configured API key and model." });
    await telegramAI.saveAdminProviderSettings(order, disabled);
    res.json({ success: true, message: "AI provider priority saved.", ai: telegramAI.status() });
  } catch (error) {
    console.error("Telegram AI provider settings save failed:", error);
    res.status(500).json({ success: false, message: "Could not save provider settings." });
  }
});

router.get("/ai-status", auth, async (req, res) => { await telegramAI.loadAdminProviderSettings(); res.json({ success: true, ...telegramAI.status() }); });

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
