const express = require("express");

const router = express.Router();

const apiAccess = require("../middleware/apiAccess");

const {
    verifyPublicLicense,
    verifyPremiumLicense,
    verifyEncryptedConnect,
    saveClientLog
} = require("../services/connectService");

router.post("/cheeta-premium", apiAccess("premium"), async (req, res) => {
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

router.post("/cheeta-public", apiAccess("public"), async (req, res) => {

    try {
        const result = (req.body && req.body.encryptedData)
            ? await verifyEncryptedConnect(req.body, req)
            : await verifyPublicLicense(req.body, req);

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

router.post("/client-log", apiAccess(), async (req, res) => {

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

});

module.exports = router;