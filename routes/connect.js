const express = require("express");

const router = express.Router();

const verifyLicense = require("../services/connectService");

router.post("/connect", async (req, res) => {

    try {

        const result =
        await verifyLicense(req.body, req);

        res.json(result);

    } catch (err) {

        console.error("Connect API Error",err);

        res.status(500).json({

            status:false,

            reason:"Internal Server Error"

        });

    }

});

module.exports = router;