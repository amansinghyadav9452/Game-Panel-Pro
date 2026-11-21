# FTW SWATI AI setup (Gemini primary + Groq fallback)

FTW SWATI uses native REST calls and Node's built-in `fetch`; no additional npm package is required. Telegram moderation remains independent and continues if either AI provider is unavailable.

## Environment variables

```env
TG_BOT_TOKEN=your_telegram_bot_token
TG_BOT_AUTOSTART=true

AI_PROVIDER=gemini
AI_FALLBACK_PROVIDER=groq
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_MODEL=gemini-3.6-flash
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-20b

TG_AI_USER_COOLDOWN_MS=30000
TG_AI_CHAT_COOLDOWN_MS=15000
TG_AI_CHAT_CAP_10M=3
```

Create a Gemini key in [Google AI Studio](https://aistudio.google.com/). Create a Groq key in [Groq Console](https://console.groq.com/keys). Add keys only as hosting environment variables; never commit them to Git or paste them into chat.

## Provider behaviour

- Gemini is attempted first by default.
- If Gemini returns an API/network error, Groq is attempted if its key is configured.
- Set `AI_FALLBACK_PROVIDER=none` to disable fallback, or swap `AI_PROVIDER` / `AI_FALLBACK_PROVIDER` to change order.
- Model IDs are configurable because providers can change model availability. Confirm that the selected model is enabled for your account in the provider console before deployment.
- No paid provider is configured by default. Free-tier quotas are finite and can change; when both providers reject requests or exhaust quota, SWATI cannot generate a reply. Check each provider's billing/usage page and do not enable paid billing if the goal is a strict ₹0 budget.

## Personality and memory

- Savage, witty, playful Hinglish personality.
- Replies to questions, direct mentions, and replies to SWATI.
- Uses recent group conversation, approved shared group memories, and the current sender's approved personal memories for tone adaptation.
- Does not reveal personal memories in public replies.
- Existing cooldowns limit autonomous replies: 30 seconds per sender, 15 seconds per group, and 3 replies per group per 10 minutes by default.
- Memory retention is configured by the existing MongoDB TTL model. Members' messages are sent to the selected AI provider when a reply is generated; review the provider's data-use terms before using real community data.

## Deployment

1. Add the environment variables above in Render (or your host).
2. Keep `TG_BOT_TOKEN` and `TG_BOT_AUTOSTART=true` configured.
3. Redeploy the service.
4. Check Admin → Telegram Moderation for bot status and AI provider configuration.
5. Test with a direct `@botusername` mention or a question in the group.

The Telegram bot must be an administrator with the permissions required by the existing moderation feature. Only one running instance should long-poll with a given bot token.
