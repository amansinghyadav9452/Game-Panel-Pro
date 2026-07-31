const Settings = require("../models/Settings");

function apiAccess(type) {

    return async (req, res, next) => {

        try {

            const settings = await Settings.findOne();

            if (!settings) {

                return next();

            }

            if (settings.api.maintenanceMode) {

                return res.status(503).json({

                    success: false,

                    message: "Panel is under maintenance. Please try again later.",

                    status: false,

                    reason: "Server is under maintenance. Please try again later."

                });

            }

            if (
                type === "public" &&
                !settings.api.publicApiEnabled
            ) {

                return res.status(403).json({

                    success: false,

                    message: "Public API is disabled.",

                    status: false,

                    reason: "Public API is currently disabled."

                });

            }

            if (
                type === "premium" &&
                !settings.api.premiumApiEnabled
            ) {

                return res.status(403).json({

                    success: false,

                    message: "Premium API is disabled.",

                    status: false,

                    reason: "Premium API is currently disabled."

                });

            }

            next();

        }

        catch (error) {

            console.error(error);

            next();

        }

    };

}

module.exports = apiAccess;