const { createRateLimiter } = require("../config/redisRest");

module.exports = createRateLimiter({
    windowMs: 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: false,
        reason: "Too many requests. Please try again later."
    }
}, "connect");
