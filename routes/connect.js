const express = require("express");

const router = express.Router();

const {
    verifyPublicLicense,
    verifyPremiumLicense,
    saveClientLog
} = require("../services/connectService");

const apiAccess = require("../middleware/connectApiAccess");
const connectRateLimiter = require("../middleware/connectRateLimiter");

router.post(

    "/connect-premium",

    connectRateLimiter,

    apiAccess("premium"),

    async (req, res) => {

        try {

            const result = await verifyPremiumLicense(req.body, req);

            res.json(result);

        } catch (err) {

            console.error("Premium Connect API Error", err);

            res.status(500).json({

                status: false,
                reason: "Internal Server Error"

            });

        }

    }

);

router.post(

    "/connect",

    connectRateLimiter,

    apiAccess("public"),

    async (req, res) => {

        try {

            const result = await verifyPublicLicense(req.body, req);

            res.json(result);

        } catch (err) {

            console.error("Connect API Error", err);

            res.status(500).json({

                status: false,
                reason: "Internal Server Error"

            });

        }

    }

);

router.post(

    "/client-log",

    connectRateLimiter,

    async (req, res) => {

        try {

            const result = await saveClientLog(req.body);

            res.json(result);

        } catch (err) {

            console.error("Client Log API Error", err);

            res.status(500).json({

                status: false,

                reason: "Internal Server Error"

            });

        }

    }

);

module.exports = router;
