const express = require("express");

const router = express.Router();

const {
    verifyPublicLicense,
    verifyPremiumLicense
} = require("../services/connectService");

router.post("/connect", async (req, res) => {

    try {

        const result =
            await verifyPublicLicense(req.body, req);

        res.json(result);

    } catch (err) {

        console.error("Connect API Error", err);

        res.status(500).json({

            status: false,
            reason: "Internal Server Error"

        });

    }

});

router.post("/connect-premium", async (req, res) => {

    try {

        const result =
            await verifyPremiumLicense(req.body, req);

        res.json(result);

    } catch (err) {

        console.error("Premium Connect API Error", err);

        res.status(500).json({

            status: false,
            reason: "Internal Server Error"

        });

    }

});

module.exports = router;