const express = require("express");
const auth = require("../middleware/auth");
const License = require("../models/License");

const router = express.Router();

router.get("/dashboard", auth, async (req, res) => {

    try {

        const totalKeys = await License.countDocuments({
            type: "public"
        });

        const activeKeys = await License.countDocuments({
            type: "public",
            status: "active"
        });

        const expiredKeys = await License.countDocuments({
            type: "public",
            status: "expired"
        });

        const bannedKeys = await License.countDocuments({
            type: "public",
            status: "banned"
        });

        res.json({

            success: true,

            stats: {

                totalKeys,

                activeKeys,

                expiredKeys,

                bannedKeys

            }

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

});

module.exports = router;