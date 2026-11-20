# Telegram Anti-Ads Moderation

This feature is integrated into the Game Panel Pro Redis-caching project.

## Configure
1. Create a Telegram bot with BotFather and copy its token.
2. Add `TG_BOT_TOKEN` to the hosting provider's environment variables.
3. Set `TG_BOT_AUTOSTART=true` to start the bot automatically when the panel process starts. Set it to `false` to require manual start from the panel.
4. Redeploy the panel.
5. Add the bot to each target group and grant administrator permission including **Delete Messages**.
6. In BotFather, use `/setprivacy` and disable Group Privacy so the bot can inspect ordinary group messages. If necessary, remove and re-add the bot to the group.
7. Open **Telegram Moderation** from the admin sidebar.

## Behavior
- Deletes group/supergroup messages containing URL entities, text hyperlinks, recognizable URLs/domains, Telegram links, or configured promotion/gambling/sponsorship keywords.
- After deletion, sends: `⚠️ Promotion and links are not allowed to be shared in this group.`
- Deletes the warning after 9 seconds. Warnings are rate-limited per group to avoid flooding.
- Stores deleted-message metadata and a short text excerpt in MongoDB.
- The admin panel exposes Start/Stop, bot status, and recent moderation logs.

## Important operating limits
- Long polling is used with Node's built-in `fetch`; no additional npm dependency is required.
- Run only one active panel instance with this bot token. Multiple instances can compete for Telegram updates and trigger `409 Conflict`.
- Bot availability follows the hosting process. If the host sleeps, the bot cannot keep polling until the process wakes.
- The bot needs Telegram's Delete Messages permission. It cannot remove messages if Telegram denies the API action.
- This implementation inspects text, captions, and Telegram message entities. OCR for image-only promotions is not included.
- URL and promotion matching is rule-based; highly obfuscated links or brand-new slang may evade detection. Review logs and tune `LINK_RE` / `PROMO_RE` in `services/telegramModeration.js` if needed.
- All human senders are moderated, including group admins. The bot ignores its own messages.

### Broadcast channel support

The bot also moderates Telegram broadcast channels when it is added as an administrator with **Delete Messages of Others** permission. Channel posts and edited channel posts are checked for links and configured promotion/gambling terms. A violating post is deleted, a short channel warning is posted, and that warning is deleted after approximately 9 seconds. Channel warnings are channel posts, not private replies.
