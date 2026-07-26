const Settings = require("../models/Settings");

/*
 * Same checks as middleware/apiAccess.js (maintenance mode, public/premium
 * API enabled) but responds using the { status, reason } shape that the
 * game client already expects from /connect and /connect-premium -
 * keeping the response contract consistent no matter why a request fails.
 */
function connectApiAccess(type) {

    return async (req, res, next) => {

        try {

            const settings = await Settings.findOne();

            if (!settings) {

                return next();

            }

            if (settings.api.maintenanceMode) {

                return res.status(503).json({

                    status: false,

                    reason: "Panel is under maintenance."

                });

            }

            if (type === "public" && !settings.api.publicApiEnabled) {

                return res.status(403).json({

                    status: false,

                    reason: "Public API is disabled."

                });

            }

            if (type === "premium" && !settings.api.premiumApiEnabled) {

                return res.status(403).json({

                    status: false,

                    reason: "Premium API is disabled."

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

module.exports = connectApiAccess;
