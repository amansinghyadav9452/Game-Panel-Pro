const express = require("express");
const auth = require("../middleware/auth");
const router = express.Router();
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const Admin = require("../models/Admin");
const Settings = require("../models/Settings");
const License = require("../models/License");
const Activity = require("../models/Activity");
const UserLog = require("../models/UserLog");
const uploadProfile = require("../middleware/uploadProfile");
const cloudinary = require("../services/cloudinary");
const streamifier = require("streamifier");
const deleteExpiredLicenses = require("../services/licenseCleanup");

router.get("/", (req, res) => {

    res.render("settings", {

        admin: req.admin,

        activePage: "settings",

        pageTitle: "Settings"

    });

});

router.get("/account", async (req, res) => {

    try {

      const admin = {
    username: ""};

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

router.get("/license", async (req, res) => {

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

router.get("/api", async (req, res) => {

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

router.get("/database", (req, res) => {

    res.render("settings/database", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "Database"

    });

});

router.get("/database/status", auth, async (req, res) => {

    try {

        const connected = mongoose.connection.readyState === 1;

        let collections = 0;

        if (connected) {

            const list = await mongoose.connection.db
                .listCollections()
                .toArray();

            collections = list.length;

        }

        return res.json({

            success: true,

            connected,

            collections

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

router.get("/database/backup", auth, async (req, res) => {

    try {

        const [settings, admins, licenses, activity, userLogs] =
            await Promise.all([

                Settings.findOne(),

                Admin.find().select("-password -biometricCredentials -twoFactorSecret -currentRegistrationChallenge -currentAuthenticationChallenge"),

                License.find(),

                Activity.find(),

                UserLog.find()

            ]);

        const backup = {

            exportedAt: new Date().toISOString(),

            version: "1.0.0",

            data: {

                settings,

                admins,

                licenses,

                activity,

                userLogs

            }

        };

        const filename =
            `game-panel-backup-${new Date().toISOString().slice(0, 10)}.json`;

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
        );

        res.setHeader("Content-Type", "application/json");

        return res.send(JSON.stringify(backup, null, 2));

    }

    catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message: "Backup failed."

        });

    }

});

router.post("/database/restore", auth, async (req, res) => {

    try {

        const backup = req.body;

        if (!backup || !backup.data) {

            return res.status(400).json({

                success: false,

                message: "Invalid backup file."

            });

        }

        const { settings, licenses, activity, userLogs } = backup.data;

        if (settings) {

            await Settings.deleteMany({});
            await Settings.create(settings);

        }

        if (Array.isArray(licenses)) {

            await License.deleteMany({});

            if (licenses.length) {
                await License.insertMany(licenses, { ordered: false });
            }

        }

        if (Array.isArray(activity)) {

            await Activity.deleteMany({});

            if (activity.length) {
                await Activity.insertMany(activity, { ordered: false });
            }

        }

        if (Array.isArray(userLogs)) {

            await UserLog.deleteMany({});

            if (userLogs.length) {
                await UserLog.insertMany(userLogs, { ordered: false });
            }

        }

        return res.json({

            success: true,

            message: "Database restored successfully."

        });

    }

    catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message: "Restore failed. The backup file may be invalid."

        });

    }

});

router.post("/database/clear-cache", auth, async (req, res) => {

    try {

        await deleteExpiredLicenses();

        const settings = await Settings.findOne();

        const retentionDays = settings?.logs?.retentionDays || 30;

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - retentionDays);

        const [activityResult, userLogResult] = await Promise.all([

            Activity.deleteMany({ createdAt: { $lte: cutoff } }),

            UserLog.deleteMany({ createdAt: { $lte: cutoff } })

        ]);

        return res.json({

            success: true,

            message: `Cache cleared. Removed ${activityResult.deletedCount + userLogResult.deletedCount} old records.`

        });

    }

    catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message: "Failed to clear cache."

        });

    }

});

router.get("/logs", async (req, res) => {

    try {

        const settings = await Settings.findOne();

        if (!settings) {

            return res.status(404).send("Settings not found");

        }

        res.render("settings/logs", {

            admin: {
                username: "Admin"
            },

            settings,

            activePage: "settings",
            pageTitle: "Logs"

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).send("Internal Server Error");

    }

});

router.get("/appearance", async (req, res) => {

    try {

        const settings = await Settings.findOne();

        if (!settings) {

            return res.status(404).send("Settings not found");

        }

        res.render("settings/appearance", {

            admin: {
                username: "Admin"
            },

            settings,

            activePage: "settings",
            pageTitle: "Appearance"

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).send("Internal Server Error");

    }

});

router.get("/notifications", async (req, res) => {

    try {

        const settings = await Settings.findOne();

        if (!settings) {

            return res.status(404).send("Settings not found");

        }

        res.render("settings/notifications", {

            admin: {
                username: "Admin"
            },

            settings,

            activePage: "settings",
            pageTitle: "Notifications"

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).send("Internal Server Error");

    }

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

router.get("/about/status", auth, async (req, res) => {

    try {

        const pkg = require("../package.json");

        return res.json({

            success: true,

            panelVersion: `v${pkg.version}`,

            nodeVersion: process.version,

            dbConnected: mongoose.connection.readyState === 1,

            environment: process.env.NODE_ENV || "development",

            uptime: process.uptime()

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

router.get("/security/status", auth, async (req, res) => {

    try {

        const hasBiometric =
            Array.isArray(req.admin.biometricCredentials) &&
            req.admin.biometricCredentials.length > 0;

        return res.json({

            success: true,

            biometricEnabled: hasBiometric

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

router.put("/logs", auth, async (req, res) => {

    try {

        const {

            retentionDays,

            displayRange

        } = req.body;

        const allowedRetention = [7, 30, 90, 365];

        const allowedRange = ["live", "2h", "24h", "7d", "1m"];

        if (!allowedRetention.includes(Number(retentionDays))) {

            return res.status(400).json({

                success: false,

                message: "Invalid log retention value."

            });

        }

        if (!allowedRange.includes(displayRange)) {

            return res.status(400).json({

                success: false,

                message: "Invalid log display range."

            });

        }

        const settings = await Settings.findOne();

        if (!settings) {

            return res.status(404).json({

                success: false,

                message: "Settings not found."

            });

        }

        settings.logs.retentionDays = Number(retentionDays);

        settings.logs.displayRange = displayRange;

        await settings.save();

        return res.json({

            success: true,

            message: "Log settings updated successfully."

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

router.get("/appearance/current", auth, async (req, res) => {

    try {

        const settings = await Settings.findOne();

        if (!settings) {

            return res.status(404).json({

                success: false,

                message: "Settings not found."

            });

        }

        return res.json({

            success: true,

            appearance: settings.appearance

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

router.put("/appearance", auth, async (req, res) => {

    try {

        const {

            darkMode,

            accentColor,

            sidebarCollapsed,

            animationsEnabled

        } = req.body;

        const allowedColors = ["blue", "purple", "green", "orange", "red"];

        if (!allowedColors.includes(accentColor)) {

            return res.status(400).json({

                success: false,

                message: "Invalid accent color."

            });

        }

        const settings = await Settings.findOne();

        if (!settings) {

            return res.status(404).json({

                success: false,

                message: "Settings not found."

            });

        }

        settings.appearance.darkMode = darkMode;
        settings.appearance.accentColor = accentColor;
        settings.appearance.sidebarCollapsed = sidebarCollapsed;
        settings.appearance.animationsEnabled = animationsEnabled;

        await settings.save();

        return res.json({

            success: true,

            message: "Appearance settings updated successfully."

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

router.put("/notifications", auth, async (req, res) => {

    try {

        const {

            telegram,

            discord,

            discordWebhookUrl,

            email,

            criticalOnly

        } = req.body;

        const webhookUrl = (discordWebhookUrl || "").trim();

        if (discord && webhookUrl) {

            const isValidWebhook =
                /^https:\/\/discord(app)?\.com\/api\/webhooks\/.+/.test(
                    webhookUrl
                );

            if (!isValidWebhook) {

                return res.status(400).json({

                    success: false,

                    message: "Invalid Discord webhook URL."

                });

            }

        }

        const settings = await Settings.findOne();

        if (!settings) {

            return res.status(404).json({

                success: false,

                message: "Settings not found."

            });

        }

        settings.notifications.telegram = telegram;
        settings.notifications.discord = discord;
        settings.notifications.discordWebhookUrl = webhookUrl;
        settings.notifications.email = email;
        settings.notifications.criticalOnly = criticalOnly;

        await settings.save();

        return res.json({

            success: true,

            message: "Notification settings updated successfully."

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

router.post("/profile/upload", auth,
    uploadProfile.single("profile"),
    async (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({
                    success: false,
                    message: "No image uploaded."
                });

            }

const result = await new Promise((resolve, reject) => {

    const uploadStream = cloudinary.uploader.upload_stream(

        {

            folder: "bhukha-panel/profile",

            public_id: `admin-${req.admin._id}`,

            overwrite: true,

            resource_type: "image"

        },

        (error, result) => {

            if (error) {

                return reject(error);

            }

            resolve(result);

        }

    );

    streamifier

        .createReadStream(req.file.buffer)

        .pipe(uploadStream);

});

const settings = await Settings.findOne();

if (!settings.panelProfile) {

    settings.panelProfile = {

        displayName: "Administrator",

        profileImage: ""

    };

}

if (!settings) {

    return res.status(404).json({

        success: false,

        message: "Settings not found."

    });

}

settings.panelProfile.profileImage = result.secure_url;

await settings.save();

return res.json({

    success: true,

    image: result.secure_url,

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

router.get("/account/me", auth, async (req, res) => {

    try {

const settings = await Settings.findOne();

if (!settings.panelProfile) {

    settings.panelProfile = {

        displayName: "Administrator",

        profileImage: ""

    };

    await settings.save();

}

if (!settings) {

    return res.status(404).json({

        success: false,

        message: "Settings not found."

    });

}

res.json({

    success: true,

    admin: {

        username: req.admin.username,

        displayName: settings.panelProfile.displayName,

        profileImage: settings.panelProfile.profileImage

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

router.put("/display-name", auth, async (req, res) => {

    try {

        const { displayName } = req.body;

        if (!displayName || !displayName.trim()) {

            return res.status(400).json({

                success: false,

                message: "Display name is required."

            });

        }

        req.admin.displayName = displayName.trim();

const settings = await Settings.findOne();

if (!settings.panelProfile) {

    settings.panelProfile = {

        displayName: "Administrator",

        profileImage: ""

    };

}

if (!settings) {

    return res.status(404).json({

        success: false,

        message: "Settings not found."

    });

}

settings.panelProfile.displayName = displayName.trim();

await settings.save();

res.json({

    success: true,

    displayName: settings.panelProfile.displayName

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