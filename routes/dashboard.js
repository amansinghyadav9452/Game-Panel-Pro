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

router.get("/dashboard/licenses", auth, async (req, res) => {

    try {

        const licenses = await License.find({
            type: "public"
        }).sort({
            createdAt: -1
        });

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

router.put("/dashboard/extend/:key", auth, async (req, res) => {

    try {

        const { days } = req.body;

        const license = await License.findOne({
            key: req.params.key
        });

        if (!license) {

            return res.status(404).json({
                success: false,
                message: "License Not Found"
            });

        }

        license.expiry = new Date(
            license.expiry.getTime() + (days * 24 * 60 * 60 * 1000)
        );

        if (license.status === "expired") {
            license.status = "active";
        }

        await license.save();

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