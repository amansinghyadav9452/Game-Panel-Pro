const express = require("express");
const auth = require("../middleware/auth");
const logActivity = require("../services/activityLogger");
const License = require("../models/License")
const apiAccess = require("../middleware/apiAccess");
const deleteExpiredLicenses = require("../services/licenseCleanup");

const {
    createLicense,
    listLicenses,
    searchLicense,
    deleteLicense
} = require("../services/licenseService");

const router = express.Router();

router.get("/premium/list", auth, async (req, res) => {

    try {

        await deleteExpiredLicenses();
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
            maxUses
        } = req.body;

        const license = await createLicense(
            key,
            "premium",
            expiryDays,
            maxUses,
            req.admin.username
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

        const { days } = req.body;

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

const baseDate =
    license.expiry > new Date()
        ? license.expiry
        : new Date();

baseDate.setDate(
    baseDate.getDate() + Number(days)
);

license.expiry = baseDate;

license.status = "active";

        await license.save();

        await logActivity({

            action: "EXTEND",

            licenseKey: license.key,

            licenseType: "premium",

            admin: req.admin.username,

            details: `${days} Days Extended`

        });

        res.json({

            success: true,

            message: "Premium Key Extended Successfully",

            expiry: license.expiry

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