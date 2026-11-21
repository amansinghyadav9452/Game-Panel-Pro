# FTW SWATI AI setup (multi-model automatic fallback)

FTW SWATI uses native REST calls and Node's built-in `fetch`; no additional npm package is required. Telegram moderation stays independent and keeps working even if every AI provider is down.

## How the fallback works

Up to 10 "slots" are tried in order. Slots without an API key are skipped. On any failure the next slot answers, and the failed slot is put on cooldown so it is not retried on every message:

| Failure | Cooldown (doubles on repeated failures, max 1h) |
|---|---|
| 429 rate limit / quota | `Retry-After` header, else 60s |
| 5xx, timeout, network error | 30s |
| 401 / 403 / 404 (bad key, model not enabled) | 15 min |
| 400 / 413 / 422 | 2 min |
| Empty or safety-blocked answer | none (just try next) |

If every slot is cooling down, the two that recover soonest are still tried, so the bot never goes permanently silent. Each request has a per-provider timeout (`TG_AI_TIMEOUT_MS`, 20s) and an overall budget (`TG_AI_TOTAL_TIMEOUT_MS`, 60s).

Default order: `gemini > groq > cerebras > openrouter > mistral > sambanova > nvidia > github > gemini2 > groq2`

## Environment variables

Add keys for at least 6 providers (all optional individually):

```env
TG_BOT_TOKEN=your_telegram_bot_token
TG_BOT_AUTOSTART=true

GEMINI_API_KEY=            # aistudio.google.com
GROQ_API_KEY=              # console.groq.com/keys
CEREBRAS_API_KEY=          # cloud.cerebras.ai
OPENROUTER_API_KEY=        # openrouter.ai/keys  (use :free models)
MISTRAL_API_KEY=           # console.mistral.ai
SAMBANOVA_API_KEY=         # cloud.sambanova.ai
NVIDIA_API_KEY=            # build.nvidia.com
GITHUB_MODELS_TOKEN=       # github.com/settings/tokens (models:read)

# Model IDs are overridable (free models change often):
# GEMINI_MODEL, GROQ_MODEL, CEREBRAS_MODEL, OPENROUTER_MODEL, MISTRAL_MODEL,
# SAMBANOVA_MODEL, NVIDIA_MODEL, GITHUB_MODEL

# Extra slots on the same key with a different model (separate quota):
# GEMINI_MODEL_2=gemini-2.5-flash-lite
# GROQ_MODEL_2=llama-3.3-70b-versatile

# Optional custom order:
# AI_PROVIDER_ORDER=groq,gemini,cerebras,openrouter,mistral,sambanova

TG_AI_USER_COOLDOWN_MS=30000
TG_AI_CHAT_COOLDOWN_MS=15000
TG_AI_CHAT_CAP_10M=3
```

Add keys only as hosting environment variables; never commit them to Git or paste them into chat.

Backward compatibility: the old `AI_PROVIDER` / `AI_FALLBACK_PROVIDER` variables still work (they just go first in the order). `AI_FALLBACK_PROVIDER=none` limits the chain to the primary only.

Notes:
- If a model ID is rejected by a provider (404/400) the chain simply skips it; fix it by setting the matching `*_MODEL` variable from that provider's console.
- Free-tier quotas are finite and can change. No paid provider is required.
- Admin → Telegram Moderation shows the active chain and which slots are cooling down.

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
5. Test with a direct `@swati` mention (the long bot username also remains supported) or a question in the group.

The Telegram bot must be an administrator with the permissions required by the existing moderation feature. Only one running instance should long-poll with a given bot token.
