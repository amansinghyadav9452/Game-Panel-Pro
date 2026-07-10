const express = require("express");

const router = express.Router();

const verifyLicense = require("../services/connectService");

router.post("/connect", async (req, res) => {

    try {

        const result =
        await verifyLicense(req.body, req,"public");

        res.json(result);

    } catch (err) {

        console.error("Connect API Error",err);

        res.status(500).json({

            status:false,

            reason:"Internal Server Error"

        });

    }

});

router.post("/connect-premium", async (req, res) => {

    try {

        const result = await verifyLicense(
            req.body,
            req,
            "premium"
        );

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