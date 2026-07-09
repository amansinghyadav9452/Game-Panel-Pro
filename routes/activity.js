const express = require("express");
const auth = require("../middleware/auth");
const Activity = require("../models/Activity");

const router = express.Router();

router.get("/activity/recent", auth, async (req, res) => {

    try {

        const activities = await Activity
            .find()
            .sort({ createdAt: -1 })
            .limit(10);

        res.json({

            success: true,

            activities

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