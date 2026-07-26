/*
 * Lightweight in-memory brute-force guard for the public license-check
 * API (/connect, /connect-premium). Tracks failed attempts per IP in a
 * sliding window and temporarily blocks IPs that exceed the threshold.
 *
 * In-memory is intentional here (single-process deployment) - no Redis
 * dependency needed. State resets on restart, which is acceptable for
 * this use case (abuse detection, not permanent banning).
 */

const WINDOW_MS = 5 * 60 * 1000;      // 5 minute sliding window
const MAX_FAILURES = 15;              // failures allowed in the window
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minute block once tripped

const attempts = new Map(); // ip -> { failures: [timestamps], blockedUntil: number }

function getEntry(ip) {

    let entry = attempts.get(ip);

    if (!entry) {

        entry = { failures: [], blockedUntil: 0 };
        attempts.set(ip, entry);

    }

    return entry;

}

function isBlocked(ip) {

    const entry = attempts.get(ip);

    if (!entry) {

        return false;

    }

    return entry.blockedUntil > Date.now();

}

function recordFailure(ip) {

    const entry = getEntry(ip);
    const now = Date.now();

    entry.failures = entry.failures.filter(
        (timestamp) => now - timestamp < WINDOW_MS
    );

    entry.failures.push(now);

    if (entry.failures.length >= MAX_FAILURES) {

        entry.blockedUntil = now + BLOCK_DURATION_MS;

    }

}

function recordSuccess(ip) {

    const entry = attempts.get(ip);

    if (entry) {

        entry.failures = [];

    }

}

// Periodic cleanup so the map doesn't grow forever.
setInterval(() => {

    const now = Date.now();

    for (const [ip, entry] of attempts.entries()) {

        const stillFailing = entry.failures.some(
            (timestamp) => now - timestamp < WINDOW_MS
        );

        if (!stillFailing && entry.blockedUntil < now) {

            attempts.delete(ip);

        }

    }

}, 10 * 60 * 1000).unref();

module.exports = {
    isBlocked,
    recordFailure,
    recordSuccess
};
