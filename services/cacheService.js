const crypto = require("crypto");
const { configured, command } = require("../config/redisRest");

const DEFAULT_TTL_SECONDS = 3600;

function safeNamespace(value) {
    return String(value).replace(/[^a-zA-Z0-9:_-]/g, "_");
}

function cacheKey(namespace, logicalKey, version) {
    const digest = crypto.createHash("sha256").update(String(logicalKey)).digest("hex");
    return `gpp:cache:${safeNamespace(namespace)}:${version}:${digest}`;
}

async function getCacheVersion(namespace) {
    const value = await command(["GET", `gpp:cache-version:${safeNamespace(namespace)}`]);
    return value == null ? "0" : String(value);
}

/**
 * MongoDB remains authoritative. Redis is only a disposable read-through cache.
 * On any Redis failure, the loader is executed directly and the request succeeds
 * from MongoDB rather than failing because of cache infrastructure.
 */
async function remember(namespace, logicalKey, ttlSeconds = DEFAULT_TTL_SECONDS, loader) {
    if (typeof loader !== "function") throw new TypeError("Cache loader must be a function");
    if (!configured) return loader();

    let redisKey = null;
    try {
        const version = await getCacheVersion(namespace);
        redisKey = cacheKey(namespace, logicalKey, version);
        const cached = await command(["GET", redisKey]);
        if (cached !== null && cached !== undefined) {
            try {
                return JSON.parse(cached);
            } catch (_) {
                await command(["DEL", redisKey]).catch(() => {});
            }
        }
    } catch (error) {
        console.warn("Redis cache read unavailable; falling back to MongoDB:", error.message);
        redisKey = null;
    }

    // Run the authoritative loader exactly once, even if Redis is offline.
    const fresh = await loader();
    if (redisKey) {
        try {
            await command(["SET", redisKey, JSON.stringify(fresh), "EX", String(Math.max(1, Number(ttlSeconds) || DEFAULT_TTL_SECONDS))]);
        } catch (error) {
            console.warn("Redis cache write unavailable; MongoDB result returned:", error.message);
        }
    }
    return fresh;
}

/**
 * Version bump invalidates every cached query in a namespace without SCAN.
 * Old entries expire naturally by TTL and are never returned after this bump.
 */
async function invalidate(namespace) {
    if (!configured) return false;
    try {
        await command(["INCR", `gpp:cache-version:${safeNamespace(namespace)}`]);
        return true;
    } catch (error) {
        console.warn("Redis cache invalidation unavailable:", error.message);
        return false;
    }
}

module.exports = { remember, invalidate, DEFAULT_TTL_SECONDS };
