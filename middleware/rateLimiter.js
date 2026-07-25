const rateLimit = require("express-rate-limit");
const Settings = require("../models/Settings");

const rateLimiter = rateLimit({

    windowMs: 15 * 60 * 1000,

    max: async (req) => {

        try {

            const settings = await Settings.findOne();

            return settings?.api?.rateLimit || 100;

        }

        catch (error) {

            console.error(error);

            return 100;

        }

    },

    standardHeaders: true,

    legacyHeaders: false,

    message: {

        success: false,

        message: "Too many requests. Please try again later."

    }

});

module.exports = rateLimiter;