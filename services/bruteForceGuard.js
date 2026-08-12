const WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 15;
const BLOCK_DURATION_MS = 15 * 60 * 1000;

const attempts = new Map();

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
