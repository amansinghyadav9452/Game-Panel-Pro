const rateLimit = require("express-rate-limit");

/*
 * Separate, stricter rate limit specifically for the public license-check
 * endpoints (/connect, /connect-premium, /client-log). Kept independent
 * from the admin panel's general rateLimiter so a flood of client
 * requests can never eat into the admin panel's request budget (or
 * vice versa).
 */
const connectRateLimiter = rateLimit({

    windowMs: 60 * 1000,

    max: 40,

    standardHeaders: true,

    legacyHeaders: false,

    message: {

        status: false,

        reason: "Too many requests. Please try again later."

    }

});

module.exports = connectRateLimiter;
