const {

    createLicense,

    listLicenses,

    searchLicense,

    deleteLicense

} = require("../services/licenseService");

const express = require("express");
const auth = require("../middleware/auth");
const logActivity = require("../services/activityLogger");

const License = require("../models/License");
const generateKey = require("../services/keyGenerator");

const router = express.Router();

router.post("/public/create", auth, async (req, res) => {

    try {

        const {

    key,

    type = "public",

    expiryDays,

    maxUses

} = req.body;

const license = await createLicense(

    key,

    type,

    expiryDays,

    maxUses,

    req.admin.username

);

await logActivity({

    action: "CREATE",

    licenseKey: license.key,

    licenseType: license.type,

    admin: req.admin.username,

    details: "Public license created"

});

        res.status(201).json({

            success: true,

            message: "Public Key Created",

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

router.get("/public/list", auth, async (req, res) => {

    try {

        const licences = await listLicenses("public");

        res.json({
            success: true,
            licenses
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

});

router.get("/public/search/:key", auth, async (req, res) => {

    try {

        const license = await searchLicense(
    "public",
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

        res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

});

router.delete("/public/delete/:key", auth, async (req, res) => {

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

    licenseType: license.type,

    admin: req.admin.username,

    details: "Public license deleted"

});

        res.json({

            success: true,

            message: "Key Deleted"

        });

    } catch (err) {

        res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

});

module.exports = router;