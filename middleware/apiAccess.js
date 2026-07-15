const Settings = require("../models/Settings");

function apiAccess(type) {

    return async (req, res, next) => {

        try {

            const settings = await Settings.findOne();

            if (!settings) {

                return next();

            }

            if (
                type === "public" &&
                !settings.api.publicApiEnabled
            ) {

                return res.status(403).json({

                    success: false,

                    message: "Public API is disabled."

                });

            }

            if (
                type === "premium" &&
                !settings.api.premiumApiEnabled
            ) {

                return res.status(403).json({

                    success: false,

                    message: "Premium API is disabled."

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