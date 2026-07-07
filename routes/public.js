const {

    createLicense,

    listLicenses,

    searchLicense,

    deleteLicense

} = require("../services/licenseService");
const express = require("express");
const auth = require("../middleware/auth");

const License = require("../models/License");
const generateKey = require("../services/keyGenerator");

const router = express.Router();

router.post("/public/create", auth, async (req, res) => {

    try {

        const { expiryDays, maxUses } = req.body;

        const license = await createLicense(
    "public",
    expiryDays,
    maxUses,
    req.admin.username
);

        res.status(201).json({

            success: true,

            message: "Public Key Created",

            license

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

});

router.get("/public/list", auth, async (req, res) => {

    try {

        const licences = await listLicences("public");

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

router.delete("/public/delete/:id", auth, async (req, res) => {

    try {

const license = await deleteLicense(
    req.params.id
);

        if (!license) {

            return res.status(404).json({

                success: false,

                message: "Key Not Found"

            });

        }

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