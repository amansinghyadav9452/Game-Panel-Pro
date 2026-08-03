const rateLimit = require("express-rate-limit");

/*
 * AI Copilot has its own strict, independent budget. Kept separate from
 * the general admin rateLimiter so a burst of AI chat messages can never
 * eat into normal panel API usage (or vice versa).
 */
const aiRateLimiter = rateLimit({

    windowMs: 60 * 1000,

    max: 15,

    standardHeaders: true,

    legacyHeaders: false,

    message: {

        success: false,

        message: "You're sending messages too quickly. Please wait a moment."

    }

});

module.exports = aiRateLimiter;
