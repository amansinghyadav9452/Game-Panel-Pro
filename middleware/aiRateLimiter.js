const { createRateLimiter } = require("../config/redisRest");

module.exports = createRateLimiter({
    windowMs: 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "You're sending messages too quickly. Please wait a moment."
    }
}, "ai");
