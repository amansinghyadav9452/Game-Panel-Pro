const express = require("express");
const router = express.Router();

const UserLog = require("../models/UserLog");
const Settings = require("../models/Settings");
const auth = require("../middleware/auth");

function getRangeCutoff(range) {

    const now = Date.now();

    switch (range) {

        case "live":
            return null;

        case "2h":
            return new Date(now - 2 * 60 * 60 * 1000);

        case "24h":
            return new Date(now - 24 * 60 * 60 * 1000);

        case "7d":
            return new Date(now - 7 * 24 * 60 * 60 * 1000);

        case "1m":
            return new Date(now - 30 * 24 * 60 * 60 * 1000);

        default:
            return null;

    }

}

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

const settings = await Settings.findOne();

const displayRange = req.query.range || settings?.logs?.displayRange || "24h";

const cutoff = getRangeCutoff(displayRange);

const filter = cutoff ? { createdAt: { $gte: cutoff } } : {};

const totalLogs = await UserLog.countDocuments(filter);

const totalPages = Math.ceil(totalLogs / limit);

const logs = await UserLog
    .find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

res.json({

    success: true,

    currentPage: page,

    totalPages,

    totalLogs,

    limit,

    range: displayRange,

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

router.get("/export", auth, async (req, res) => {

    try {

        const type = req.query.type === "errors" ? "errors" : "all";

        const filter = type === "errors" ? { status: "failed" } : {};

        const logs = await UserLog
            .find(filter)
            .sort({ createdAt: -1 });

        const escape = (value) =>
            `"${String(value ?? "").replace(/"/g, '""')}"`;

        const header = [
            "Timestamp",
            "License Key",
            "License Type",
            "Status",
            "Reason",
            "Serial",
            "Device Model",
            "Device Brand",
            "Android Version"
        ].join(",");

        const rows = logs.map((log) => [
            new Date(log.createdAt).toISOString(),
            log.licenseKey,
            log.licenseType,
            log.status,
            log.reason,
            log.serial,
            log.deviceModel,
            log.deviceBrand,
            log.androidVersion
        ].map(escape).join(","));

        const csv = [header, ...rows].join("\n");

        const filename =
            type === "errors"
                ? `error-logs-${Date.now()}.csv`
                : `user-logs-${Date.now()}.csv`;

        res.setHeader("Content-Type", "text/csv");

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
        );

        res.send(csv);

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

});

module.exports = router;