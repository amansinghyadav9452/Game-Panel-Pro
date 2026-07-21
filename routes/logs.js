const express = require("express");
const router = express.Router();

const UserLog = require("../models/UserLog");
const auth = require("../middleware/auth");

router.get("/",(req, res) => {

    res.render("logs", {
        activePage: "logs",
        pageTitle: "User Logs"
    });

});

router.get("/recent", auth, async (req, res) => {

    try {

const page = Math.max(parseInt(req.query.page) || 1, 1);

const limit = Math.max(parseInt(req.query.limit) || 100, 1);

const skip = (page - 1) * limit;

const totalLogs = await UserLog.countDocuments();

const totalPages = Math.ceil(totalLogs / limit);

const logs = await UserLog
    .find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

res.json({

    success: true,

    currentPage: page,

    totalPages,

    totalLogs,

    limit,

    logs

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