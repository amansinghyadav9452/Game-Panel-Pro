const express = require("express");

const router = express.Router();


// Count every API-authorized key-verification request at the route boundary,
// including malformed encrypted payloads and replay attempts.
async function countVerificationRequest(req, res, next) {
    try {
        await recordVerificationRequest(req.body || {});
    } catch (error) {
        console.error("Verification activity counter error:", error);
    }
    next();
}

const apiAccess = require("../middleware/apiAccess");

const {
    verifyPublicLicense,
    verifyPremiumLicense,
    verifyEncryptedConnect,
    recordVerificationRequest,
    saveClientLog
} = require("../services/connectService");

router.post("/bhuka_cheeta-premium", apiAccess("premium"), countVerificationRequest, async (req, res) => {
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

router.post("/bhuka_cheeta-public", apiAccess("public"), countVerificationRequest, async (req, res) => {

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