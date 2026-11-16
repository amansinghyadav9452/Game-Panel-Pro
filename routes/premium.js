const express = require("express");
const auth = require("../middleware/auth");
const logActivity = require("../services/activityLogger");
const License = require("../models/License")
const UserLog = require("../models/UserLog");
const { resolveMarketingName } = require("../services/deviceLookup");
const Settings = require("../models/Settings");
const apiAccess = require("../middleware/apiAccess");
// Expired-license deletion runs on a background schedule (see server.js).

const {
    createLicense,
    listLicenses,
    searchLicense,
    deleteLicense
} = require("../services/licenseService");

const router = express.Router();

router.get("/premium/list", auth, apiAccess("premium"), async (req, res) => {

    try {

        const licenses = await listLicenses("premium");

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

router.get("/premium/license/:key", auth, apiAccess("premium"), async (req, res) => {

    try {

        const license = await License.findOne({
            key: req.params.key,
            type: "premium"
        }).lean();

        if (!license) {
            return res.status(404).json({
                success: false,
                message: "Premium License Not Found"
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
            if (!name && log?.deviceBrand && log?.deviceModel) name = `${log.deviceBrand} ${log.deviceModel}`.trim();
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

router.post("/premium/create", auth, apiAccess("premium"), async (req, res) => {

    try {

        const {
            key,
            expiryDays,
            maxUses,
            gameId
        } = req.body;

        let finalExpiryDays = Number(expiryDays);
        let finalMaxUses = Number(maxUses);

        if (!Number.isFinite(finalExpiryDays) || !Number.isFinite(finalMaxUses)) {

            const settings = await Settings.findOne();

            if (!Number.isFinite(finalExpiryDays)) {
                finalExpiryDays = settings ? settings.license.premiumExpiry : 30;
            }

            if (!Number.isFinite(finalMaxUses)) {
                finalMaxUses = settings ? settings.license.maxDevices : 1;
            }

        }

        const license = await createLicense(
            key,
            "premium",
            finalExpiryDays,
            finalMaxUses,
            req.admin.username,
            req.admin.gameId || gameId || "PUBG"
        );

        await logActivity({

    action: "CREATE",

    licenseKey: license.key,

    licenseType: "premium",

    admin: req.admin.username,

    details: "Premium Key Created"

});

        res.status(201).json({
            success: true,
            message: "Premium Key Created",
            license
        });

    } catch (err) {

        console.error(err);

        if (err.message === "Invalid Game ID") {

        return res.status(400).json({

            success: false,

            message: "Invalid or disabled Game ID"

        });

    }

    if (err.message === "License Key Already Exists") {

            return res.status(400).json({
                success: false,
                message: err.message
            });

        }

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

});

router.get("/premium/search/:key", auth, apiAccess("premium"), async (req, res) => {

    try {

        const license = await searchLicense(
            "premium",
            req.params.key
        );

        if (!license) {

            return res.status(404).json({
                success: false,
                message: "Key Not Found"
            });

        }

        res.json({
            success: true,
            license
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

});

router.delete("/premium/delete/:key", auth, apiAccess("premium"), async (req, res) => {

    try {

        const license = await deleteLicense(
            req.params.key,
            "premium"
        );

        if (!license) {

            return res.status(404).json({

                success: false,

                message: "Key Not Found"

            });

        }

        await logActivity({

            action: "DELETE",

            licenseKey: license.key,

            licenseType: "premium",

            admin: req.admin.username,

            details: "Premium Key Deleted"

        });

        res.json({

            success: true,

            message: "Premium Key Deleted"

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

});

router.put("/premium/ban/:key", auth, apiAccess("premium"), async (req, res) => {

    try {

        const license = await License.findOne({
            key: req.params.key,
            type: "premium"
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

            licenseType: "premium",

            admin: req.admin.username,

            details: "Premium Key Banned"

        });

        res.json({

            success: true,

            message: "Premium Key Banned Successfully"

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

});

router.put("/premium/unban/:key", auth, apiAccess("premium"), async (req, res) => {

    try {

        const license = await License.findOne({
            key: req.params.key,
            type: "premium"
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

            licenseType: "premium",

            admin: req.admin.username,

            details: "Premium Key Unbanned"

        });

        res.json({

            success: true,

            message: "Premium Key Unbanned Successfully"

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

});

router.put("/premium/extend/:key", auth, apiAccess("premium"), async (req, res) => {
    try {
        const mode = req.body.mode === "device" ? "device" : "license";
        const license = await License.findOne({
            key: req.params.key,
            type: "premium"
        });

        if (!license) {
            return res.status(404).json({ success: false, message: "License Not Found" });
        }

        if (mode === "device") {
            const value = Number(req.body.value !== undefined ? req.body.value : req.body.days);
            if (!Number.isInteger(value) || value <= 0) {
                return res.status(400).json({ success: false, message: "Enter a valid positive device count." });
            }

            const addCount = Math.min(10000, value);
            license.maxUses = (license.maxUses || 0) + addCount;
            await license.save();

            await logActivity({
                action: "EXTEND",
                licenseKey: license.key,
                licenseType: "premium",
                admin: req.admin.username,
                details: `Device limit +${addCount} (now ${license.maxUses})`
            });

            return res.json({
                success: true,
                message: "Device Limit Extended Successfully",
                maxUses: license.maxUses
            });
        }

        let newExpiry;
        if (req.body.expiry !== undefined) {
            newExpiry = new Date(req.body.expiry);
        } else {
            // Backward compatibility for older clients that still submit a day count.
            const days = Number(req.body.value !== undefined ? req.body.value : req.body.days);
            if (!Number.isFinite(days)) {
                return res.status(400).json({ success: false, message: "Choose a valid expiry date and time." });
            }
            newExpiry = new Date(license.expiry || Date.now());
            newExpiry.setDate(newExpiry.getDate() + Math.floor(days));
        }

        if (Number.isNaN(newExpiry.getTime())) {
            return res.status(400).json({ success: false, message: "Choose a valid expiry date and time." });
        }

        const previousExpiry = license.expiry;
        license.expiry = newExpiry;
        if (license.status !== "banned") {
            license.status = newExpiry <= new Date() ? "expired" : "active";
        }

        await license.save();

        await logActivity({
            action: "EXTEND",
            licenseKey: license.key,
            licenseType: "premium",
            admin: req.admin.username,
            details: `Key expiry changed from ${previousExpiry ? new Date(previousExpiry).toISOString() : "unset"} to ${newExpiry.toISOString()}`
        });

        return res.json({
            success: true,
            message: newExpiry <= new Date() ? "Key expiry updated. The key is now expired." : "Key expiry updated successfully.",
            previousExpiry,
            expiry: license.expiry,
            status: license.status
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
});

router.put("/premium/reset-device/:key", auth, apiAccess("premium"), async (req, res) => {

    try {

        const license = await License.findOne({
            key: req.params.key,
            type: "premium"
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

            licenseType: "premium",

            admin: req.admin.username,

            details: "Premium Device Reset"

        });

        res.json({

            success: true,

            message: "Premium Device Reset Successfully"

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