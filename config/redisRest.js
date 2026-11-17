const crypto = require("crypto");

const redisUrl = String(
    process.env.REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL || ""
).replace(/\/+$/, "");
const redisToken = String(
    process.env.REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ""
);

const configured = Boolean(redisUrl && redisToken);
let redisWarningShown = false;

async function command(args) {
    if (!configured) throw new Error("Redis REST is not configured");

    const response = await fetch(redisUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${redisToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
        throw new Error(`Redis REST request failed (${response.status})`);
    }

    const payload = await response.json();
    if (payload.error) throw new Error("Redis command failed");
    return payload.result;
}

function warnRedisFallback(error) {
    if (redisWarningShown) return;
    redisWarningShown = true;
    console.error("Redis unavailable; using per-instance in-memory fallback:", error.message);
}

async function ping() {
    if (!configured) return false;
    try {
        await command(["PING"]);
        return true;
    } catch (error) {
        warnRedisFallback(error);
        return false;
    }
}

function replayKey(fingerprint) {
    const digest = crypto.createHash("sha256").update(String(fingerprint)).digest("hex");
    return `gpp:replay:${digest}`;
}

const localReplay = new Map();
const REPLAY_LUA = `
local current = redis.call('SET', KEYS[1], '1', 'NX', 'PX', ARGV[1])
if current then return 0 else return 1 end
`;

async function isReplay(fingerprint, windowMs = 5000) {
    const key = replayKey(fingerprint);
    if (configured) {
        try {
            const result = await command(["EVAL", REPLAY_LUA, "1", key, String(windowMs)]);
            return Number(result) === 1;
        } catch (error) {
            warnRedisFallback(error);
        }
    }

    const now = Date.now();
    const expiresAt = localReplay.get(key) || 0;
    if (expiresAt > now) return true;
    if (localReplay.size > 5000) {
        for (const [entry, expiry] of localReplay) {
            if (expiry <= now) localReplay.delete(entry);
        }
    }
    localReplay.set(key, now + windowMs);
    return false;
}

// express-rate-limit Store backed by Upstash REST. A local fallback keeps
// the panel available during a temporary Redis outage; it is per-process
// until Redis connectivity returns.
const RATE_LIMIT_LUA = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return { hits, ttl }
`;

class UpstashRateLimitStore {
    constructor(prefix) {
        this.prefix = `gpp:ratelimit:${prefix}:`;
        this.windowMs = 60000;
        this.local = new Map();
    }

    init(options) {
        this.windowMs = options.windowMs;
    }

    async increment(key) {
        const redisKey = `${this.prefix}${key}`;
        if (configured) {
            try {
                const result = await command(["EVAL", RATE_LIMIT_LUA, "1", redisKey, String(this.windowMs)]);
                const totalHits = Number(result?.[0]) || 1;
                const ttl = Math.max(0, Number(result?.[1]) || this.windowMs);
                return { totalHits, resetTime: new Date(Date.now() + ttl) };
            } catch (error) {
                warnRedisFallback(error);
            }
        }

        const now = Date.now();
        let entry = this.local.get(key);
        if (!entry || entry.resetAt <= now) {
            entry = { totalHits: 0, resetAt: now + this.windowMs };
        }
        entry.totalHits += 1;
        this.local.set(key, entry);
        return { totalHits: entry.totalHits, resetTime: new Date(entry.resetAt) };
    }

    async decrement(key) {
        const redisKey = `${this.prefix}${key}`;
        if (configured) {
            try {
                await command(["DECR", redisKey]);
                return;
            } catch (error) {
                warnRedisFallback(error);
            }
        }
        const entry = this.local.get(key);
        if (entry) entry.totalHits = Math.max(0, entry.totalHits - 1);
    }

    async resetKey(key) {
        const redisKey = `${this.prefix}${key}`;
        if (configured) {
            try {
                await command(["DEL", redisKey]);
            } catch (error) {
                warnRedisFallback(error);
            }
        }
        this.local.delete(key);
    }
}

function createRateLimitStore(prefix) {
    return configured ? new UpstashRateLimitStore(prefix) : undefined;
}

function createRateLimiter(options, prefix) {
    const rateLimit = require("express-rate-limit");
    return rateLimit({
        ...options,
        ...(configured ? { store: createRateLimitStore(prefix) } : {}),
        passOnStoreError: true
    });
}

module.exports = {
    configured,
    command,
    ping,
    isReplay,
    createRateLimiter
};
