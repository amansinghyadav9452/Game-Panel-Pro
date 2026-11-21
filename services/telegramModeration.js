const TelegramModerationLog = require("../models/TelegramModerationLog");
const telegramAI = require("./telegramAI");

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

const GROUP_WARNING = "⚠️ Promotion and links are not allowed to share in this group.";
const CHANNEL_WARNING = "⚠️ Promotion and links are not allowed to share in this channel.";
const LINK_RE = /(?:https?:\/\/|http:\/\/|ftp:\/\/|www\.)[^\s<>()]+|(?:t\.me|telegram\.me|telegram\.dog)\/[^\s<>()]+|\b[a-z0-9][a-z0-9.-]*\.(?:com|net|org|io|in|co|gg|me|xyz|app|dev|site|online|info|biz|link|click|top|win|bet|casino|club|live|shop|store|pro|tech)(?:\/[^\s]*)?/i;
const PROMO_RE = /\b(teen\s*patti|casino|betting|bet\s*now|gambling|stake|rummy|poker|earn\s*money|make\s*money|refer\s*&?\s*earn|referral\s*bonus|join\s*(our|my|the)\s*(channel|group|club)|subscribe\s*(to|our|my)|follow\s*(us|me|our)|paid\s*promotion|sponsored\s*(post|content)|promotion|promotional|advertisement|advertising|advert|dm\s*for\s*(promo|promotion|details)|contact\s*for\s*(promo|promotion|business)|collab(orate|oration)|giveaway|bonus\s*code|discount\s*code|investment\s*plan|crypto\s*signals|telegram\s*channel)\b/i;
// Telegram usernames are 5-32 characters, begin with a letter, and may contain
// letters, digits and underscores. Deliberately remove any visible @username.
const USERNAME_RE = /(?:^|[^A-Za-z0-9_])@[A-Za-z][A-Za-z0-9_]{4,31}\b/;

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
function hasOwnBotMention(msg, botUsername) {
  const expectedNames = new Set(['swati']);
  if (botUsername) expectedNames.add(String(botUsername).replace(/^@/, '').toLowerCase());
  const text = String(msg.text || msg.caption || '');
  const entities = [...(msg.entities || []), ...(msg.caption_entities || [])];
  // Telegram entity offsets/lengths are UTF-16 code units, matching JS slice().
  for (const entity of entities) {
    if (entity.type !== 'mention') continue;
    const value = text.slice(entity.offset, entity.offset + entity.length).replace(/^@/, '').toLowerCase();
    if (expectedNames.has(value)) return true;
  }
  // A plain standalone “swati” also addresses the bot; exempt it from username moderation.
  if (/(?:^|[^A-Za-z0-9_])swati(?![A-Za-z0-9_])/i.test(text)) return true;
  return [...expectedNames].some(name => new RegExp(`(?:^|[^A-Za-z0-9_])@${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_])`, 'i').test(text));
}
function detect(update) {
  const msg = messageOf(update);
  if (!msg) return null;
  const entities = [...(msg.entities || []), ...(msg.caption_entities || [])];
  const linkedEntity = entities.some(entity => ["url", "text_link"].includes(entity.type));
  const botMention = hasOwnBotMention(msg, botInfo?.username);
  // Explicitly addressing SWATI opts this message into AI chat; never delete it via moderation.
  if (botMention) return null;
  const mentionEntity = entities.some(entity => entity.type === "text_mention" || entity.type === "mention" && !botMention);
  const text = [msg.text, msg.caption].filter(Boolean).join("\n");
  if (linkedEntity || LINK_RE.test(text)) return "Link detected";
  // A mention of this bot is an intentional AI trigger, not a promotional username.
  const ownNames = ['swati', ...(botInfo?.username ? [String(botInfo.username).replace(/^@/, '')] : [])];
  const withoutBotMention = ownNames.reduce((value, name) => value.replace(new RegExp(`(?:^|[^A-Za-z0-9_])@${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_])`, 'ig'), ' '), text);
  if (mentionEntity || USERNAME_RE.test(withoutBotMention)) return "Telegram username detected";
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
      displayName: [from.first_name, from.last_name].filter(Boolean).join(" ") || msg.author_signature || (msg.sender_chat?.title || ""),
      reason,
      excerpt: String(msg.text || msg.caption || "").slice(0, 240)
    });
  } catch (error) {
    console.error("[Telegram moderation] Log save failed:", error.message);
  }
}
async function moderate(update) {
  const msg = messageOf(update);
  if (!msg || !msg.chat || !["group", "supergroup", "channel"].includes(msg.chat.type)) return;
  if (botInfo && msg.from?.id === botInfo.id) return;
  const reason = detect(update);
  if (!reason) {
    // AI is deliberately downstream of moderation: deleted content is never sent to the model.
    const senderIsBot = Boolean(msg.from?.is_bot);
    if (telegramAI.enabled() && !senderIsBot && (msg.from || msg.chat.type === "channel")) {
      // Never hold Telegram getUpdates processing open while an AI provider is
      // generating a response. A slow provider used to stall the polling loop,
      // making SWATI appear asleep after a few messages.
      Promise.resolve()
        .then(() => telegramAI.generateReply(msg, botInfo?.username))
        .catch(error => {
          lastError = `AI: ${error.message}`;
          console.error("[Telegram AI] Background reply failed:", error.stack || error.message);
        });
    }
    return;
  }
  try {
    await telegram("deleteMessage", { chat_id: msg.chat.id, message_id: msg.message_id });
    await saveLog(msg, reason);
    const chatKey = String(msg.chat.id);
    if ((warningAt.get(chatKey) || 0) < Date.now() - 2500) {
      warningAt.set(chatKey, Date.now());
      const warningText = msg.chat.type === "channel" ? CHANNEL_WARNING : GROUP_WARNING;
      const warning = await telegram("sendMessage", { chat_id: msg.chat.id, text: warningText });
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
      // Advance offsets immediately and process the batch without serially
      // waiting on slow Telegram moderation calls. AI replies are detached above.
      for (const update of updates) offset = Math.max(offset, update.update_id + 1);
      await Promise.allSettled(updates.map(update => moderate(update)));
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
