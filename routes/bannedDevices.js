const express = require("express");
const router = express.Router();

const BannedDevice = require("../models/BannedDevice");
const auth = require("../middleware/auth");

router.use(auth);

/*
    GET ALL
*/

router.get("/", async (req, res) => {

    try {

        const devices = await BannedDevice
            .find()
            .sort({ bannedAt: -1 });

        res.json(devices);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

});

/*
    GET SINGLE DEVICE
*/

router.get("/:serial", async (req, res) => {

    try {

        const device = await BannedDevice.findOne({
            serial: req.params.serial
        });

        if (!device) {

            return res.status(404).json({
                success: false,
                message: "Device not found."
            });

        }

        res.json({
            success: true,
            device
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

/*
    BAN DEVICE
*/

router.post("/ban", async (req, res) => {

    try {

        const {

            serial,
            userKey,
            deviceBrand,
            deviceModel,
            androidVersion,
            appVersion,
            bannedBy,
            reason

        } = req.body;

        if (!serial) {

    return res.status(400).json({
        success: false,
        message: "Serial is required."
    });

}

        const exists = await BannedDevice.findOne({
            serial
        });

        if (exists) {

            return res.status(400).json({

                success: false,
                message: "Device already banned."

            });

        }

        const banned = await BannedDevice.create({

            serial,
            userKey,
            deviceBrand,
            deviceModel,
            androidVersion,
            appVersion,
            bannedBy,
            reason

        });

        res.json({

            success: true,
            banned

        });

    } catch (err) {

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

});

/*
    UNBAN DEVICE
*/

router.delete("/:serial", async (req, res) => {

    try {

        await BannedDevice.deleteOne({

            serial: req.params.serial

        });

        res.json({

            success: true

        });

    } catch (err) {

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

});

module.exports = router;