const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const Admin = require("../models/Admin");
const Settings = require("../models/Settings");

router.get("/", (req, res) => {

    res.render("settings", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",

        pageTitle: "Settings"

    });

});

router.get("/account", async (req, res) => {

    try {

        const admin = await Admin.findOne();

        if (!admin) {

            return res.status(404).json({

                success: false,

                message: "Admin not found."

            });

        }

        res.render("settings/account", {

            admin,

            activePage: "settings",

            pageTitle: "Account"

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).send("Internal Server Error");

    }

});

router.get("/security", async (req, res) => {

    try {

        const admin = await Admin.findOne();

        const settings = await Settings.findOne();

        if (!admin || !settings) {

            return res.status(404).send("Settings not found");

        }

        res.render("settings/security", {

            admin,

            settings,

            activePage: "settings",

            pageTitle: "Security"

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).send("Internal Server Error");

    }

});

router.get("/license", async (req, res) => {

    try {

        const admin = await Admin.findOne();

        const settings = await Settings.findOne();

        if (!admin || !settings) {

            return res.status(404).send("Settings not found");

        }

        res.render("settings/license", {

            admin,

            settings,

            activePage: "settings",

            pageTitle: "License"

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).send("Internal Server Error");

    }

});

router.get("/api", async (req, res) => {

    try {

        const admin = await Admin.findOne();

        const settings = await Settings.findOne();

        if (!admin || !settings) {

            return res.status(404).send("Settings not found");

        }

        res.render("settings/api", {

            admin,

            settings,

            activePage: "settings",

            pageTitle: "API"

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).send("Internal Server Error");

    }

});

router.get("/database", (req, res) => {

    res.render("settings/database", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "Database"

    });

});

router.get("/logs", (req, res) => {

    res.render("settings/logs", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "Logs"

    });

});

router.get("/appearance", (req, res) => {

    res.render("settings/appearance", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "Appearance"

    });

});

router.get("/notifications", (req, res) => {

    res.render("settings/notifications", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "Notifications"

    });

});

router.get("/about", (req, res) => {

    res.render("settings/about", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "About"

    });

});

router.put("/account", async (req, res) => {

    try{

        const { username } = req.body;

        if(!username || username.trim() === ""){

            return res.status(400).json({

                success:false,

                message:"Username is required."

            });

        }

        const admin = await Admin.findOne();

        admin.username = username.trim();

        await admin.save();

        return res.json({

            success:true,

            message:"Account updated successfully."

        });

    }

    catch(error){

        console.error(error);

        return res.status(500).json({

            success:false,

            message:"Internal server error."

        });

    }

});

router.put("/account/password", async (req, res) => {

    try {

        const {

            currentPassword,

            newPassword,

            confirmPassword

        } = req.body;

        if (!currentPassword || !newPassword || !confirmPassword) {

            return res.status(400).json({

                success: false,

                message: "All fields are required."

            });

        }

        if (newPassword !== confirmPassword) {

            return res.status(400).json({

                success: false,

                message: "Passwords do not match."

            });

        }

        const admin = await Admin.findOne();

        if (!admin) {

            return res.status(404).json({

                success: false,

                message: "Admin not found."

            });

        }

        const matched = await bcrypt.compare(

            currentPassword,

            admin.password

        );

        if (!matched) {

            return res.status(401).json({

                success: false,

                message: "Current password is incorrect."

            });

        }

        admin.password = await bcrypt.hash(

            newPassword,

            12

        );

        admin.sessionVersion += 1;

        await admin.save();

        return res.json({

            success: true,

            message: "Password changed successfully."

        });

    }

    catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message: "Internal server error."

        });

    }

});

router.post("/account/logout-all", async (req, res) => {

    const admin = await Admin.findOne();

    admin.sessionVersion += 1;

    await admin.save();

    res.json({

        success:true,

        message:"All devices logged out."

    });

});

router.get("/account/2fa/setup", async (req, res) => {

    const admin = await Admin.findOne();

    if (!admin) {

        return res.status(404).json({

            success:false

        });

    }

});

router.put("/security", async (req, res) => {

    try {

        const {

            turnstileEnabled,

            forceSingleLogin,

            sessionTimeout,

            jwtExpiry,

            rateLimit

        } = req.body;

        const settings = await Settings.findOne();

        if (!settings) {

            return res.status(404).json({

                success: false,

                message: "Settings not found."

            });

        }

        settings.security.turnstileEnabled = turnstileEnabled;

        settings.security.forceSingleLogin = forceSingleLogin;

        settings.security.sessionTimeout = Number(sessionTimeout);

        settings.security.jwtExpiry = jwtExpiry;

        settings.api.rateLimit = Number(rateLimit);

        await settings.save();

        return res.json({

            success: true,

            message: "Security settings updated successfully."

        });

    }

    catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message: "Internal server error."

        });

    }

});

router.put("/license", async (req, res) => {

    try {

        const {

            publicPrefix,

            premiumPrefix,

            publicExpiry,

            premiumExpiry,

            maxDevices,

            licenseLength,

            autoUppercase

        } = req.body;

        const settings = await Settings.findOne();

        if (!settings) {

            return res.status(404).json({

                success: false,

                message: "Settings not found."

            });

        }

        settings.license.publicPrefix = publicPrefix.trim();

        settings.license.premiumPrefix = premiumPrefix.trim();

        settings.license.publicExpiry = Number(publicExpiry);

        settings.license.premiumExpiry = Number(premiumExpiry);

        settings.license.maxDevices = Number(maxDevices);

        settings.license.licenseLength = Number(licenseLength);

        settings.license.autoUppercase = autoUppercase;

        await settings.save();

        return res.json({

            success: true,

            message: "License settings updated successfully."

        });

    }

    catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message: "Internal server error."

        });

    }

});

router.put("/api", async (req, res) => {

    try {

        const {

            publicApiEnabled,

            premiumApiEnabled,

            maintenanceMode,

            rateLimit

        } = req.body;

        const settings = await Settings.findOne();

        if (!settings) {

            return res.status(404).json({

                success: false,

                message: "Settings not found."

            });

        }

        settings.api.publicApiEnabled = publicApiEnabled;

        settings.api.premiumApiEnabled = premiumApiEnabled;

        settings.api.maintenanceMode = maintenanceMode;

        settings.api.rateLimit = Number(rateLimit);

        await settings.save();

        return res.json({

            success: true,

            message: "API settings updated successfully."

        });

    }

    catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message: "Internal server error."

        });

    }

});

module.exports = router;