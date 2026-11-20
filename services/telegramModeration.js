const TelegramModerationLog = require("../models/TelegramModerationLog");

let running = false;
let stopRequested = false;
let pollingPromise = null;
let botInfo = null;
let startedAt = null;
let lastError = "";
let offset = 0;
let warningAt = new Map();
let warningTimers = new Set();
let consecutivePollingFailures = 0;

const WARNING = "⚠️ Promotion and links are not allowed to be shared in this group.";
const LINK_RE = /(?:https?:\/\/|http:\/\/|ftp:\/\/|www\.)[^\s<>()]+|(?:t\.me|telegram\.me|telegram\.dog)\/[^\s<>()]+|\b[a-z0-9][a-z0-9.-]*\.(?:com|net|org|io|in|co|gg|me|xyz|app|dev|site|online|info|biz|link|click|top|win|bet|casino|club|live|shop|store|pro|tech)(?:\/[^\s]*)?/i;
const PROMO_RE = /\b(teen\s*patti|casino|betting|bet\s*now|gambling|stake|rummy|poker|earn\s*money|refer\s*&?\s*earn|referral\s*bonus|join\s*(our|my)\s*(channel|group|club)|paid\s*promotion|sponsored\s*post|promotion|advertisement|advertising|dm\s*for\s*(promo|promotion)|contact\s*for\s*(promo|promotion)|giveaway|bonus\s*code)\b/i;

function token() {
  const value = String(process.env.TG_BOT_TOKEN || "").trim();
  if (!value) throw new Error("TG_BOT_TOKEN is not configured.");
  return value;
}

function describeError(error) {
  let root = error;
  while (root?.cause) root = root.cause;
  const code = root?.code || error?.code || "UNKNOWN";
  const message = root?.message || error?.message || "Unknown error";
  return `${message} [${code}]`;
}

async function telegram(method, payload = {}) {
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json", "connection": "keep-alive" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(method === "getUpdates" ? 22000 : 15000)
    });
  } catch (error) {
    const wrapped = new Error(`Telegram ${method} network request failed: ${describeError(error)}`);
    wrapped.cause = error;
    wrapped.networkError = true;
    throw wrapped;
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    const wrapped = new Error(`Telegram ${method} returned an invalid response (HTTP ${response.status}).`);
    wrapped.cause = error;
    throw wrapped;
  }
  if (!response.ok || !data.ok) {
    const error = new Error(data.description || `Telegram API ${method} failed (HTTP ${response.status})`);
    error.telegramCode = data.error_code;
    error.retryAfter = data.parameters?.retry_after;
    throw error;
  }
  return data.result;
}
function messageOf(update) {
  return update.message || update.edited_message || update.channel_post || update.edited_channel_post;
}
function detect(update) {
  const msg = messageOf(update);
  if (!msg) return null;
  const entities = [...(msg.entities || []), ...(msg.caption_entities || [])];
  const linkedEntity = entities.some(entity => ["url", "text_link"].includes(entity.type));
  const text = [msg.text, msg.caption].filter(Boolean).join("\n");
  if (linkedEntity || LINK_RE.test(text)) return "Link detected";
  if (PROMO_RE.test(text)) return "Promotion detected";
  return null;
}
async function saveLog(msg, reason) {
  const from = msg.from || {};
  try {
    await TelegramModerationLog.create({
      chatId: String(msg.chat.id),
      chatTitle: msg.chat.title || msg.chat.username || "",
      messageId: msg.message_id,
      userId: from.id ? String(from.id) : "",
      username: from.username || "",
      displayName: [from.first_name, from.last_name].filter(Boolean).join(" "),
      reason,
      excerpt: String(msg.text || msg.caption || "").slice(0, 240)
    });
  } catch (error) {
    console.error("[Telegram moderation] Log save failed:", error.message);
  }
}
async function moderate(update) {
  const msg = messageOf(update);
  if (!msg || !msg.chat || !["group", "supergroup"].includes(msg.chat.type)) return;
  if (botInfo && msg.from?.id === botInfo.id) return;
  const reason = detect(update);
  if (!reason) return;
  try {
    await telegram("deleteMessage", { chat_id: msg.chat.id, message_id: msg.message_id });
    await saveLog(msg, reason);
    const chatKey = String(msg.chat.id);
    if ((warningAt.get(chatKey) || 0) < Date.now() - 2500) {
      warningAt.set(chatKey, Date.now());
      const warning = await telegram("sendMessage", { chat_id: msg.chat.id, text: WARNING });
      const timer = setTimeout(async () => {
        warningTimers.delete(timer);
        try { await telegram("deleteMessage", { chat_id: msg.chat.id, message_id: warning.message_id }); } catch (_) {}
      }, 9000);
      warningTimers.add(timer);
      timer.unref?.();
    }
  } catch (error) {
    lastError = error.message;
    console.error("[Telegram moderation] Moderation action failed:", error.message);
  }
}
async function pollLoop() {
  while (!stopRequested) {
    try {
      // Keep Telegram's long-poll timeout shorter than the HTTP request timeout.
      const updates = await telegram("getUpdates", {
        offset,
        timeout: 15,
        allowed_updates: ["message", "edited_message", "channel_post", "edited_channel_post"]
      });
      consecutivePollingFailures = 0;
      for (const update of updates) {
        offset = update.update_id + 1;
        await moderate(update);
      }
    } catch (error) {
      if (stopRequested) break;
      consecutivePollingFailures += 1;
      lastError = describeError(error);
      const delay = error.retryAfter
        ? Math.max(1000, error.retryAfter * 1000)
        : Math.min(30000, 2000 * (2 ** Math.min(consecutivePollingFailures - 1, 4)));
      console.error(`[Telegram bot] Polling failed (attempt ${consecutivePollingFailures}); retrying in ${Math.ceil(delay / 1000)}s: ${lastError}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
async function start() {
  if (running) return { running: true };
  stopRequested = false;
  lastError = "";
  consecutivePollingFailures = 0;
  botInfo = await telegram("getMe");
  // Clear any pending webhook: long polling and webhook cannot run together.
  await telegram("deleteWebhook", { drop_pending_updates: false });
  running = true;
  startedAt = new Date();
  pollingPromise = pollLoop().finally(() => { running = false; });
  return { running: true, username: botInfo.username };
}
async function stop() {
  stopRequested = true;
  for (const timer of warningTimers) clearTimeout(timer);
  warningTimers.clear();
  if (pollingPromise) await Promise.race([
    pollingPromise,
    new Promise(resolve => setTimeout(resolve, 3000))
  ]);
  running = false;
  pollingPromise = null;
  startedAt = null;
  return { running: false };
}
function status() {
  return {
    configured: Boolean(process.env.TG_BOT_TOKEN),
    running,
    username: botInfo?.username || "",
    startedAt,
    lastError
  };
}
module.exports = { start, stop, status };
