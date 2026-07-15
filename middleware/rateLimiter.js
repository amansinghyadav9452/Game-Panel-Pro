const rateLimit = require("express-rate-limit");
const Settings = require("../models/Settings");

const rateLimiter = async (req, res, next) => {

    try {

        const settings = await Settings.findOne();

        const maxRequests =
            settings?.api?.rateLimit || 100;

        return rateLimit({

            windowMs: 15 * 60 * 1000,

            max: maxRequests,

            standardHeaders: true,

            legacyHeaders: false,

            message: {

                success: false,

                message: "Too many requests. Please try again later."

            }

        })(req, res, next);

    }

    catch (error) {

        console.error(error);

        next();

    }

};

module.exports = rateLimiter;