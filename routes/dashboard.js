const express = require("express");
const auth = require("../middleware/auth");
const License = require("../models/License");
const {
    syncLicenseStatus
} = require("../services/licenseService");
const { listLicenses } = require("../services/licenseService");

const router = express.Router();
const logActivity = require("../services/activityLogger");
const deleteExpiredLicenses =
require("../services/licenseCleanup");

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

        await deleteExpiredLicenses();
        const licenses = await License.find();

        let activeKeys = 0;
        let expiredKeys = 0;
        let bannedKeys = 0;

for (const license of licenses) {

    await syncLicenseStatus(license);

    if (license.status === "banned") {

        bannedKeys++;

    } else if (license.status === "expired") {

        expiredKeys++;

    } else {

        activeKeys++;

    }

}

        res.json({

            success: true,

            stats: {

                totalKeys: licenses.length,

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

router.get("/dashboard/licenses", auth, async (req, res) => {

    try {

        await deleteExpiredLicenses();
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

        const license = await License.findOne({

            key: req.params.key

        });

        if (!license) {

            return res.status(404).json({

                success: false,

                message: "License Not Found"

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

            key: req.params.key

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

        const { days } = req.body;

        console.log("=========== REQUEST DEBUG ===========");
console.log("Request Body:", req.body);
console.log("Days:", days);
console.log("Expiry Before:", license.expiry);

        const license = await License.findOne({
            key: req.params.key
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

const updatedLicense = await License.findById(license._id);

res.json({
    success: true,
    message: "License Extended Successfully",
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

module.exports = router;