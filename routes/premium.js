const express = require("express");
const auth = require("../middleware/auth");
const logActivity = require("../services/activityLogger");
const License = require("../models/License")
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

router.get("/premium/list", auth, async (req, res) => {

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
            gameId || "PUBG"
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
            req.params.key
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

        const value = Number(req.body.value !== undefined ? req.body.value : req.body.days);

        if (!Number.isFinite(value) || value <= 0) {

            return res.status(400).json({
                success: false,
                message: "Enter a valid positive number."
            });

        }

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

        if (mode === "device") {

            const addCount = Math.min(100, Math.floor(value));

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

const baseDate = new Date(
    license.expiry > new Date()
        ? license.expiry
        : new Date()
);

baseDate.setDate(
    baseDate.getDate() + Math.floor(value)
);

license.expiry = baseDate;
license.status = "active";

await license.save();

const fresh = await License.findById(license._id);

await logActivity({

    action: "EXTEND",

    licenseKey: fresh.key,

    licenseType: "premium",

    admin: req.admin.username,

    details: `${Math.floor(value)} Days Extended`

});

res.json({

    success: true,

    message: "Premium Key Extended Successfully",

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