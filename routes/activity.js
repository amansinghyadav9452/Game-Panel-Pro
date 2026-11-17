const express = require("express");
const auth = require("../middleware/auth");
const Activity = require("../models/Activity");
const { remember } = require("../services/cacheService");

const router = express.Router();

router.get("/activity/recent", auth, async (req, res) => {

    try {

        const payload = await remember("admin:activity-logs", "recent", 3600, async () => {
            const activities = await Activity.find().sort({ createdAt: -1 }).lean();
            return { success: true, activities };
        });

        res.json(payload);

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

});

// Deletes ALL admin activity logs (the CRUD action history shown on the
// dashboard's recent activity feed). Confirmation-only — no password,
// since it doesn't touch any client/user data.
router.delete("/activity/clear", auth, async (req, res) => {

    try {

        const result = await Activity.deleteMany({});

        res.json({

            success: true,

            message: "Admin logs cleared successfully.",

            deletedCount: result.deletedCount

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