const express = require("express");

const router = express.Router();

const {
    verifyPublicLicense,
    verifyPremiumLicense
} = require("../services/connectService");

router.post("/connect-premium", async (req, res) => {
    console.log("Premium License called");

    try {

        console.log("Premium route hit");

        const result =
            await verifyPremiumLicense(req.body, req);

            console.log(JSON.stringify(result,null,2));

        res.json(result);

    } catch (err) {

        console.error("Premium Connect API Error", err);

        res.status(500).json({

            status: false,
            reason: "Internal Server Error"

        });

    }

});

router.post("/connect", async (req, res) => {

    try {

        const result =
            await verifyPublicLicense(req.body, req);

            console.log(JSON.stringify(result,null,2));

        res.json(result);

    } catch (err) {

        console.error("Connect API Error", err);

        res.status(500).json({

            status: false,
            reason: "Internal Server Error"

        });

    }

});

module.exports = router;