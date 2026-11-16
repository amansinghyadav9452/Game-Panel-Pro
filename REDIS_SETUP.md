# Redis setup (Upstash REST)

This project uses Upstash Redis REST without an extra runtime package, so it
works on Render without opening a persistent TCP connection.

## Render environment variables

Create a Redis database in Upstash, then add these variables to the Render
web service (do not commit the token):

- `REDIS_REST_URL`: the Upstash REST URL, e.g. `https://<database>.upstash.io`
- `REDIS_REST_TOKEN`: the Upstash REST token

The app also accepts `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` if those names are already used in your environment.

## What Redis handles

- Shared API, connect, AI, login, OTP, and password-reset rate limits across
  multiple Node instances.
- Atomic five-second anti-replay guard for encrypted game-connect requests.

MongoDB remains the source of truth for accounts, keys, licenses, devices,
activities, and permanent user logs. Redis is not used as permanent storage.

## Fallback behaviour

If Redis variables are absent, the app retains its existing in-memory rate
limiting and replay protection. If the configured Redis service temporarily
fails, requests fall back to per-process in-memory protection and a warning is
logged once. During a Redis outage, rate limits and replay protection are no
longer shared across multiple server instances; restore Redis to regain that
cross-instance protection.

## Deploy check

After adding the two variables and deploying, check Render logs for:

`Redis REST connected; shared rate limits and anti-replay protection are active.`

Do not paste the REST token into chat, GitHub, or source files.
