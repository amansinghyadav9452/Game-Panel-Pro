const Settings = require("../models/Settings");
const { createRateLimiter } = require("../config/redisRest");

module.exports = createRateLimiter({
    windowMs: 60 * 1000,
    max: async () => {
        try {
            const settings = await Settings.findOne();
            return settings?.api?.rateLimit || 100;
        } catch (error) {
            console.error("Rate-limit settings lookup failed:", error.message);
            return 100;
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please try again later."
    }
}, "api");
