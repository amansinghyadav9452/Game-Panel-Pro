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
const unansweredTimers = new Map();
const adminCache = new Map();
const PROFANITY_RE = /\b(fuck(?:er|ing)?|shit(?:ty)?|bitch(?:es)?|asshole|bastard|motherfucker|madarchod|bhenchod|behenchod|chutiya|gaand|gandu|bsdk|bhosdike|harami|randi|lodu|lawde|lund|mc|bc)\b/i;

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
async function getChatAdmins(chatId) {
  const key = String(chatId), cached = adminCache.get(key);
  if (cached && cached.until > Date.now()) return cached.usernames;
  try {
    const admins = await telegram('getChatAdministrators', { chat_id: chatId });
    const usernames = new Set(admins.map(a => String(a.user?.username || '').toLowerCase()).filter(Boolean));
    adminCache.set(key, { usernames, until: Date.now() + 5 * 60 * 1000 });
    return usernames;
  } catch (_) { return new Set(); }
}
async function isAdminMessage(msg) {
  if (!msg.from?.id || !['group','supergroup','channel'].includes(msg.chat.type)) return false;
  try {
    const member = await telegram('getChatMember', { chat_id: msg.chat.id, user_id: msg.from.id });
    return ['creator','administrator'].includes(member.status);
  } catch (_) { return false; }
}
async function detect(update) {
  const msg = messageOf(update);
  if (!msg) return null;
  const text = [msg.text, msg.caption].filter(Boolean).join('\n');
  if (PROFANITY_RE.test(text)) return 'Abusive language detected';
  const entities = [...(msg.entities || []), ...(msg.caption_entities || [])];
  if (hasOwnBotMention(msg, botInfo?.username)) return null;
  const senderAdmin = await isAdminMessage(msg);
  const adminUsernames = await getChatAdmins(msg.chat.id);
  const ownNames = ['swati', ...(botInfo?.username ? [String(botInfo.username).replace(/^@/, '')] : [])];
  const withoutBotMention = ownNames.reduce((value, name) => value.replace(new RegExp('(?:^|[^A-Za-z0-9_])@' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9_])', 'ig'), ' '), text);
  const mentioned = [...withoutBotMention.matchAll(/(?:^|[^A-Za-z0-9_])@([A-Za-z][A-Za-z0-9_]{4,31})\b/g)].map(m => m[1].toLowerCase());
  const badMention = mentioned.some(name => !adminUsernames.has(name));
  const badTextMention = entities.some(e => e.type === 'text_mention' && !adminUsernames.has(String(e.user?.username || '').toLowerCase()));
  const linked = entities.some(e => ['url','text_link'].includes(e.type)) || LINK_RE.test(text);
  if (linked) return 'Link detected';
  if (badMention || badTextMention) return senderAdmin ? null : 'Telegram username detected';
  if (PROMO_RE.test(text)) return 'Promotion detected';
  return null;
}
function scheduleUnanswered(msg) {
  if (!msg?.chat || !['group','supergroup','channel'].includes(msg.chat.type) || !msg.from?.id || msg.from.is_bot) return;
  const text = String(msg.text || msg.caption || '').trim();
  if (!text || !(/\?/.test(text) || /\b(kaise|kyu|kyun|kya|kab|kahan|kidhar|where|what|when|why|how|who|help|batao|btao)\b/i.test(text))) return;
  const key = `${msg.chat.id}:${msg.from.id}`;
  const old = unansweredTimers.get(key); if (old) clearTimeout(old.timer);
  const entry = { messageId: msg.message_id, msg, timer: null };
  entry.timer = setTimeout(async () => {
    unansweredTimers.delete(key);
    try { await telegramAI.generateReply(msg, botInfo?.username, { forceTrigger: true, delayedUnanswered: true }); }
    catch (error) { lastError = `Delayed AI reply: ${error.message}`; console.error('[Telegram AI] Delayed reply failed:', error.message); }
  }, 120000);
  entry.timer.unref?.(); unansweredTimers.set(key, entry);
}
function cancelAnsweredTimer(msg) {
  const repliedId = msg.reply_to_message?.message_id;
  if (!repliedId) return;
  for (const [key, entry] of unansweredTimers) if (String(entry.msg.chat.id) === String(msg.chat.id) && entry.messageId === repliedId) {
    clearTimeout(entry.timer); unansweredTimers.delete(key);
  }
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
async function handleCommand(msg) {
  const raw = String(msg.text || '').trim();
  if (!raw.startsWith('/')) return false;
  const [head, ...args] = raw.split(/\s+/);
  const command = head.split('@')[0].slice(1).toLowerCase();
  const chatId = msg.chat.id;
  const replyUser = msg.reply_to_message?.from;
  if (['start','help'].includes(command)) {
    await telegram('sendMessage', { chat_id: chatId, text: 'Hiii! 💗 Main SWATI hoon. Mujhse normal chat karo ya /swati ke saath apna message likho. Commands: /rules, /id, /swati. Admin moderation: /warn, /mute, /unmute, /ban (reply to a member), /unban USER_ID.' , reply_to_message_id: msg.message_id });
    return true;
  }
  if (command === 'rules') {
    await telegram('sendMessage', { chat_id: chatId, text: '📌 Group rules:\n• No abusive language\n• No ads, promotions or links\n• No unsolicited usernames/mentions\n• Respect everyone', reply_to_message_id: msg.message_id }); return true;
  }
  if (command === 'id') {
    await telegram('sendMessage', { chat_id: chatId, text: `Chat ID: ${chatId}\nYour ID: ${msg.from?.id || 'unavailable'}`, reply_to_message_id: msg.message_id }); return true;
  }
  if (command === 'swati') return false;
  if (!['warn','mute','unmute','ban','unban'].includes(command)) return false;
  if (!(await isAdminMessage(msg))) {
    await telegram('sendMessage', { chat_id: chatId, text: 'Ye command sirf group admins use kar sakte hain.', reply_to_message_id: msg.message_id }); return true;
  }
  const targetId = command === 'unban' ? args[0] : replyUser?.id;
  if (!targetId) {
    await telegram('sendMessage', { chat_id: chatId, text: command === 'unban' ? 'Usage: /unban USER_ID' : 'Is command ko member ke message par reply karke use karo.', reply_to_message_id: msg.message_id }); return true;
  }
  if (String(targetId) === String(botInfo?.id)) {
    await telegram('sendMessage', { chat_id: chatId, text: 'Mujhe hi ban/mute karne ka plan hai? Cute try. 😌', reply_to_message_id: msg.message_id }); return true;
  }
  if (command === 'warn') {
    await telegram('sendMessage', { chat_id: chatId, text: `⚠️ ${replyUser?.first_name || 'Member'}, please follow the group rules.`, reply_to_message_id: msg.reply_to_message.message_id });
  } else if (command === 'mute') {
    await telegram('restrictChatMember', { chat_id: chatId, user_id: targetId, permissions: { can_send_messages: false, can_send_audios: false, can_send_documents: false, can_send_photos: false, can_send_videos: false, can_send_video_notes: false, can_send_voice_notes: false, can_send_polls: false, can_send_other_messages: false, can_add_web_page_previews: false }, use_independent_chat_permissions: true, until_date: Math.floor(Date.now()/1000) + 3600 });
    await telegram('sendMessage', { chat_id: chatId, text: '🔇 Member muted for 1 hour.' });
  } else if (command === 'unmute') {
    await telegram('restrictChatMember', { chat_id: chatId, user_id: targetId, permissions: { can_send_messages: true, can_send_audios: true, can_send_documents: true, can_send_photos: true, can_send_videos: true, can_send_video_notes: true, can_send_voice_notes: true, can_send_polls: true, can_send_other_messages: true, can_add_web_page_previews: true }, use_independent_chat_permissions: true });
    await telegram('sendMessage', { chat_id: chatId, text: '🔊 Member unmuted.' });
  } else if (command === 'ban') {
    await telegram('banChatMember', { chat_id: chatId, user_id: targetId });
    await telegram('sendMessage', { chat_id: chatId, text: '⛔ Member banned.' });
  } else if (command === 'unban') {
    await telegram('unbanChatMember', { chat_id: chatId, user_id: targetId, only_if_banned: true });
    await telegram('sendMessage', { chat_id: chatId, text: 'Member unbanned.' });
  }
  return true;
}
async function moderate(update) {
  const msg = messageOf(update);
  if (!msg || !msg.chat) return;
  if (botInfo && msg.from?.id === botInfo.id) return;
  const chatType = msg.chat.type;
  const isModeratedChat = ["group", "supergroup", "channel"].includes(chatType);
  const isPrivateChat = chatType === "private";
  if (!isModeratedChat && !isPrivateChat) return;
  if (msg.chat.type !== 'channel' && await handleCommand(msg)) return;

  // Link/promotion moderation remains group/channel-only. Private chats are
  // treated as a direct conversation with SWATI, not as moderated communities.
  cancelAnsweredTimer(msg);
  const reason = isModeratedChat ? await detect(update) : null;
  if (!reason) {
    if (isModeratedChat) scheduleUnanswered(msg);
    const senderIsBot = Boolean(msg.from?.is_bot);
    if (telegramAI.enabled() && !senderIsBot && (msg.from || chatType === "channel")) {
      // AI runs detached from getUpdates so slow providers never block polling.
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
      const warningText = reason === "Abusive language detected" ? "🚫 Abusive language is not allowed. Please keep the conversation respectful. This message was removed." : (msg.chat.type === "channel" ? CHANNEL_WARNING : GROUP_WARNING);
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
  try { await telegram('setMyCommands', { commands: [
    { command: 'start', description: 'Start chatting with SWATI' },
    { command: 'help', description: 'Show available commands' },
    { command: 'rules', description: 'Show group rules' },
    { command: 'id', description: 'Show chat and user IDs' },
    { command: 'swati', description: 'Talk to SWATI' },
    { command: 'warn', description: 'Warn a replied-to member (admin)' },
    { command: 'mute', description: 'Mute a replied-to member (admin)' },
    { command: 'unmute', description: 'Unmute a replied-to member (admin)' },
    { command: 'ban', description: 'Ban a replied-to member (admin)' },
    { command: 'unban', description: 'Unban by user ID (admin)' }
  ] }); } catch (error) { console.warn('[Telegram bot] Command menu setup failed:', error.message); }
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
  for (const entry of unansweredTimers.values()) clearTimeout(entry.timer);
  unansweredTimers.clear();
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
