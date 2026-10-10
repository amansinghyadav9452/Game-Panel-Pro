const express = require("express");
const auth = require("../middleware/auth");
const License = require("../models/License");
const UserLog = require("../models/UserLog");
const { resolveMarketingName } = require("../services/deviceLookup");
const {
    syncLicenseStatus,
    listLicenses,
    bulkSyncLicenseStatuses
} = require("../services/licenseService");

const router = express.Router();
const logActivity = require("../services/activityLogger");
// Expired-license deletion now runs on a background schedule (see server.js)
// instead of blocking every page load — see services/licenseCleanup.js.

router.get("/panel", (req, res) => {

    res.render("dashboard", {

        activePage: "dashboard",
        pageTitle: "Dashboard",
        admin: req.admin

    });

});

router.get("/public-keys", (req, res) => {

    res.render("public-keys", {

        activePage: "public-keys",
        pageTitle: "Public Keys",
        admin: req.admin

    });

});

router.get("/activity", (req, res) => {

    res.render("activity", {

        activePage: "activity",
        pageTitle: "Activity Logs"

    });

});

router.get("/dashboard", auth, async (req, res) => {

    try {

        // Bulk-flip any active<->expired licenses in ONE update per
        // direction (was: fetch every license, then save() each one
        // individually — the main reason this page felt slow).
        await bulkSyncLicenseStatuses();

        const counts = await License.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);

        let activeKeys = 0;
        let expiredKeys = 0;
        let bannedKeys = 0;

        for (const row of counts) {

            if (row._id === "banned") bannedKeys = row.count;
            else if (row._id === "expired") expiredKeys = row.count;
            else if (row._id === "active") activeKeys = row.count;

        }

        const totalKeys = activeKeys + expiredKeys + bannedKeys;

        // Counts are based on real records for the current India-local day.
        const Activity = require("../models/Activity");
        const now = new Date();
        const indiaNow = new Date(now.getTime() + 330 * 60 * 1000);
        const dayStart = new Date(Date.UTC(indiaNow.getUTCFullYear(), indiaNow.getUTCMonth(), indiaNow.getUTCDate()) - 330 * 60 * 1000);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const todayActivities = await Activity.find({ createdAt: { $gte: dayStart, $lt: dayEnd } }).select("action").lean();
        const today = {
            totalKeys: todayActivities.filter(x => x.action === "CREATE").length,
            activeKeys: todayActivities.filter(x => ["CREATE", "UNBAN"].includes(x.action)).length,
            expiredKeys: await License.countDocuments({ status: "expired", expiry: { $gte: dayStart, $lt: dayEnd } }),
            bannedKeys: todayActivities.filter(x => x.action === "BAN").length
        };

        res.json({ success: true, stats: { totalKeys, activeKeys, expiredKeys, bannedKeys, today } });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

});

router.get("/dashboard/licenses", auth, async (req, res) => {

    try {

        const licenses = await listLicenses("public");

        res.json({
            success: true,
            licenses
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

});

router.get("/dashboard/license/:key", auth, async (req, res) => {

    try {

        const license = await License.findOne({ key: req.params.key }).lean();

        if (!license) {

            return res.status(404).json({
                success: false,
                message: "License Not Found"
            });

        }

        const serials = Array.isArray(license.devices) ? license.devices.filter(Boolean) : [];
        const logs = serials.length
            ? await UserLog.find({
                licenseKey: license.key,
                serial: { $in: serials },
                status: "success"
            })
                .sort({ createdAt: -1 })
                .select("serial deviceMarketingName deviceBrand deviceModel androidVersion createdAt")
                .lean()
            : [];

        const latestBySerial = new Map();
        for (const log of logs) {
            if (log.serial && !latestBySerial.has(log.serial)) latestBySerial.set(log.serial, log);
        }

        const devices = await Promise.all(serials.map(async (serial, index) => {
            const log = latestBySerial.get(serial);
            let name = log?.deviceMarketingName || "";

            if (!name && log?.deviceModel) {
                const resolved = await resolveMarketingName(log.deviceModel);
                name = resolved?.marketingName || "";
            }

            if (!name && log?.deviceBrand && log?.deviceModel) {
                name = `${log.deviceBrand} ${log.deviceModel}`.trim();
            }

            if (!name && log?.deviceModel) name = log.deviceModel;
            if (!name && log?.deviceBrand) name = `${log.deviceBrand} device`;
            if (!name) name = `Registered Device ${index + 1}`;

            return {
                name,
                brand: log?.deviceBrand || "",
                model: log?.deviceModel || "",
                androidVersion: log?.androidVersion || "",
                registeredAt: log?.createdAt || null
            };
        }));

        res.json({
            success: true,
            license: { ...license, devices }
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

});

router.put("/dashboard/ban/:key", auth, async (req, res) => {

    try {

        const license = await License.findOne({
            key: req.params.key
        });

        if (!license) {

            return res.status(404).json({
                success: false,
                message: "License Not Found"
            });

        }

        license.status = "banned";

        await license.save();

        await logActivity({

    action: "BAN",

    licenseKey: license.key,

    licenseType: license.type,

    admin: req.admin.username,

    details: "License banned"

});

            res.json({
            success: true,
            message: "License Banned Successfully"
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

});

router.put("/dashboard/unban/:key", auth, async (req, res) => {

    try {

        const license = await License.findOne({

            key: req.params.key,
            type: "public"

        });

        if (!license) {

            return res.status(404).json({

                success: false,

                message: "License Not Found"

            });

        }

        license.status = "active";

        await license.save();

        await logActivity({

    action: "UNBAN",

    licenseKey: license.key,

    licenseType: license.type,

    admin: req.admin.username,

    details: "License unbanned"

});

        res.json({

            success: true,

            message: "License Unbanned Successfully"

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

});

router.put("/dashboard/extend/:key", auth, async (req, res) => {

    try {

const mode = req.body.mode === "device" ? "device" : "license";

const value = Number(req.body.value !== undefined ? req.body.value : req.body.days);

if (!Number.isFinite(value) || value <= 0) {

    return res.status(400).json({
        success: false,
        message: "Enter a valid positive number."
    });

}

const license = await License.findOne({
    key: req.params.key
});

if (!license) {

    return res.status(404).json({
        success: false,
        message: "License Not Found"
    });

}

if (mode === "device") {

    const addCount = Math.min(10000, Math.floor(value));

    license.maxUses = (license.maxUses || 0) + addCount;

    await license.save();

    // Track public-key device-limit extensions in the dashboard activity feed.
    await logActivity({
        action: "EXTEND",
        licenseKey: license.key,
        licenseType: license.type || "public",
        admin: req.admin.username,
        details: `Device limit +${addCount} (now ${license.maxUses})`
    });

    return res.json({

        success: true,
        message: "Device Limit Extended Successfully",
        maxUses: license.maxUses

    });

}

console.log("Expiry Before:", license.expiry);

const baseDate = new Date(
    license.expiry > new Date()
        ? license.expiry
        : new Date()
);

baseDate.setDate(baseDate.getDate() + Math.floor(value));

license.expiry = baseDate;
license.status = "active";

await license.save();

const fresh = await License.findById(license._id);

res.json({
    success: true,
    message: "License Extended Successfully",
    expiry: fresh.expiry
});

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

});

router.put("/dashboard/reset-device/:key", auth, async (req, res) => {

    try {

        const license = await License.findOne({
            key: req.params.key
        });

        if (!license) {

            return res.status(404).json({
                success: false,
                message: "License Not Found"
            });

        }

        license.devices = [];
        license.usedCount = 0;
        license.lastDevice = null;
        license.lastUsed = null;

        await license.save();

        await logActivity({
            action: "RESET_DEVICE",
            licenseKey: license.key,
            licenseType: license.type,
            admin: req.admin.username,
            details: "Device reset; registered devices cleared"
        });

        res.json({
            success: true,
            message: "Device Reset Successfully"
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

});

router.get("/banned-devices", (req, res) => {

    res.render("banned-devices", {

        activePage: "banned-devices",
        pageTitle: "Banned Devices",
        admin: req.admin

    });

});

module.exports = router;