const express = require("express");
const auth = require("../middleware/auth");
const router = express.Router();
const bcrypt = require("bcrypt");
const Admin = require("../models/Admin");
const Settings = require("../models/Settings");
const uploadProfile = require("../middleware/uploadProfile");

router.get("/", auth, (req, res) => {

    res.render("settings", {

        admin: req.admin,

        activePage: "settings",

        pageTitle: "Settings"

    });

});

router.get("/account", auth, async (req, res) => {

    try {

      const admin = {
    username: "Admin"};

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

router.get("/security",auth, async (req, res) => {

    try {

      const admin = {
    username: "Admin"};

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

router.get("/license",auth, async (req, res) => {

    try {

      const admin = {
    username: "Admin"};

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

router.get("/api", auth, async (req, res) => {

    try {

      const admin = {
    username: "Admin"};

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

router.get("/database", auth, (req, res) => {

    res.render("settings/database", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "Database"

    });

});

router.get("/logs", auth, (req, res) => {

    res.render("settings/logs", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "Logs"

    });

});

router.get("/appearance", auth,(req, res) => {

    res.render("settings/appearance", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "Appearance"

    });

});

router.get("/notifications", auth, (req, res) => {

    res.render("settings/notifications", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "Notifications"

    });

});

router.get("/about", auth, (req, res) => {

    res.render("settings/about", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "About"

    });

});

router.put("/account",  auth, async (req, res) => {

    try{

        const { username } = req.body;
        const usernameRegex = /^[A-Za-z0-9_]+$/;

        if(!username || username.trim() === ""){

            return res.status(400).json({

                success:false,

                message:"Username is required."

            });

        }
if (username.trim().length < 3 || username.trim().length > 30) {

    return res.status(400).json({

        success: false,

        message: "Username must be between 3 and 30 characters."

    });

}

if (!usernameRegex.test(username.trim())) {

    return res.status(400).json({

        success: false,

        message: "Username can contain only letters, numbers and underscore."

    });

}

req.admin.username = username.trim();

await req.admin.save();

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

router.put("/account/password",  auth, async (req, res) => {

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

const admin = req.admin;

        if (newPassword.length < 8) {

    return res.status(400).json({

        success: false,

        message: "Password must be at least 8 characters."

    });

}

    if (currentPassword === newPassword) {

    return res.status(400).json({

        success: false,

        message: "New password must be different."

    });

}

    const passwordRegex =
/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#])[A-Za-z\d@$!%*?&_#]{8,64}$/;

if (!passwordRegex.test(newPassword)) {

    return res.status(400).json({

        success: false,

        message: "Password must contain uppercase, lowercase, number and special character."

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

router.post("/account/logout-all",  auth, async (req, res) => {

req.admin.sessionVersion++;

await req.admin.save();

    res.json({

        success:true,

        message:"All devices logged out."

    });

});

router.get("/account/2fa/setup",  async (req, res) => {

  const admin = {
    username: "Admin"};

    if (!admin) {

        return res.status(404).json({

            success:false

        });

    }

});

router.put("/security",  auth, async (req, res) => {

    try {

        const {

            currentPassword,

            turnstileEnabled,

            forceSingleLogin,

            sessionTimeout,

            jwtExpiry,

            rateLimit

        } = req.body;

        if (!currentPassword) {

    return res.status(400).json({

        success: false,

        message: "Current password is required."

    });

}

const matched = await bcrypt.compare(

    currentPassword,

    req.admin.password

);

if (!matched) {

    return res.status(401).json({

        success: false,

        message: "Current password is incorrect."

    });

}

        const settings = await Settings.findOne();

        if (!settings) {

            return res.status(404).json({

                success: false,

                message: "Settings not found."

            });

        }

        settings.security.jwtExpiry = jwtExpiry;

        settings.security.turnstileEnabled = turnstileEnabled;

        settings.security.forceSingleLogin = forceSingleLogin;

        settings.security.sessionTimeout = Number(sessionTimeout);

        settings.api.rateLimit = Number(rateLimit);

        if (
    sessionTimeout < 5 ||
    sessionTimeout > 1440
) {

    return res.status(400).json({

        success: false,

        message: "Session timeout must be between 5 and 1440 minutes."

    });

}

if (
    rateLimit < 1 ||
    rateLimit > 1000
) {

    return res.status(400).json({

        success: false,

        message: "Rate limit must be between 1 and 1000."

    });

}

const allowedExpiry = [

    "15m",

    "30m",

    "1h",

    "12h",

    "24h",

    "7d"

];

if (!allowedExpiry.includes(jwtExpiry)) {

    return res.status(400).json({

        success: false,

        message: "Invalid JWT expiry."

    });

}

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

router.delete("/security/biometric", auth, async (req, res) => {

    try {

        const { currentPassword } = req.body;

        if (!currentPassword) {

            return res.status(400).json({

                success: false,

                message: "Current password is required."

            });

        }

        const matched = await bcrypt.compare(

            currentPassword,

            req.admin.password

        );

        if (!matched) {

            return res.status(401).json({

                success: false,

                message: "Current password is incorrect."

            });

        }

        req.admin.biometricCredentials = [];

        await req.admin.save();

        return res.json({

            success: true,

            message: "Biometric removed successfully."

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

router.put("/license",  auth, async (req, res) => {

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

router.put("/api",  auth, async (req, res) => {

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

router.post(
    "/profile/upload",
    auth,
    uploadProfile.single("profile"),
    async (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({
                    success: false,
                    message: "No image uploaded."
                });

            }

            req.admin.profileImage =
                `/uploads/profile/${req.file.filename}`;

            await req.admin.save();

            return res.json({

                success: true,

                image: req.admin.profileImage,

                message: "Profile photo updated successfully."

            });

        } catch (error) {

            console.error(error);

            return res.status(500).json({

                success: false,

                message: "Internal server error."

            });

        }

    }
);

module.exports = router;