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
const Session = require("../models/Session");
const { getDeviceLabel } = require("../services/deviceLabel");
const uploadProfile = require("../middleware/uploadProfile");
const cloudinary = require("../services/cloudinary");
const streamifier = require("streamifier");
const deleteExpiredLicenses = require("../services/licenseCleanup");
const { generateOtp, hashOtp, compareOtp, OTP_TTL_MS } = require("../services/otp");
const { sendOtpEmail } = require("../services/mailer");
const generateKey = require("../services/keyGenerator");

router.get("/", (req, res) => {

    res.render("settings", {

        admin: req.admin,

        activePage: "settings",

        pageTitle: "Settings"

    });

});

router.get("/status", auth, async (req, res) => {

    try {

        const settings = await Settings.findOne();

        const isHttps =
            req.secure ||
            req.headers["x-forwarded-proto"] === "https";

        const rateLimit = settings?.api?.rateLimit || 100;

        const environment = process.env.NODE_ENV || "development";

        return res.json({

            success: true,

            jwt: {

                active: true,

                expiry: settings?.security?.jwtExpiry || "1h"

            },

            passwordHashing: {

                algorithm: "bcrypt",

                saltRounds: 12

            },

            https: {

                enabled: isHttps

            },

            helmet: {

                enabled: true

            },

            rateLimiter: {

                active: true,

                limit: rateLimit,

                windowMinutes: 1

            },

            cors: {

                restricted: Boolean(
                    process.env.CORS_ORIGINS || process.env.WEBAUTHN_ORIGIN
                )

            },

            securityHeaders: {

                applied: true

            },

            environment

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

router.get("/license/config", auth, async (req, res) => {

    try {

        const settings = await Settings.findOne();

        if (!settings) {

            return res.status(404).json({

                success: false,

                message: "Settings not found."

            });

        }

        res.json({

            success: true,

            license: settings.license

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: "Internal server error."

        });

    }

});

router.get("/license/generate-key", auth, async (req, res) => {

    try {

        const type = req.query.type === "premium" ? "premium" : "public";

        const settings = await Settings.findOne();

        let key;
        let attempts = 0;

        do {

            key = generateKey(type, settings ? settings.license : null);

            attempts++;

        } while (

            attempts < 10 &&
            (await License.findOne({ key }))

        );

        res.json({

            success: true,

            key

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: "Internal server error."

        });

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

router.get("/account/sessions",  auth, async (req, res) => {

try {

    const sessions = await Session.find({

        adminId: req.admin._id

    }).sort({ lastActiveAt: -1 });

    const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

    res.json({

        success: true,

        sessions: sessions.map(s => ({

            id: s.sessionId,

            deviceLabel: s.deviceLabel || getDeviceLabel(s.userAgent),

            ip: s.ip,

            createdAt: s.createdAt,

            lastActiveAt: s.lastActiveAt,

            current: s.sessionId === req.sessionId,

            status:
                (Date.now() - new Date(s.lastActiveAt).getTime()) < ACTIVE_WINDOW_MS
                    ? "active"
                    : "offline"

        }))

    });

}

catch (error) {

    console.error(error);

    res.status(500).json({

        success: false,

        message: "Internal server error."

    });

}

});

router.delete("/account/sessions/:sessionId",  auth, async (req, res) => {

try {

    const deleted = await Session.findOneAndDelete({

        sessionId: req.params.sessionId,

        adminId: req.admin._id

    });

    if (!deleted) {

        return res.status(404).json({

            success: false,

            message: "Session not found."

        });

    }

    res.json({

        success: true,

        message: "Session terminated."

    });

}

catch (error) {

    console.error(error);

    res.status(500).json({

        success: false,

        message: "Internal server error."

    });

}

});

router.post("/account/logout-all",  auth, async (req, res) => {

req.admin.sessionVersion++;

await req.admin.save();

await Session.deleteMany({ adminId: req.admin._id });

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

            publicExpiry,

            premiumExpiry,

            maxDevices,

            licenseLength,

            autoUppercase

        } = req.body;

        const numPublicExpiry = Number(publicExpiry);
        const numPremiumExpiry = Number(premiumExpiry);
        const numMaxDevices = Number(maxDevices);
        const numLicenseLength = Number(licenseLength);

        if (

            !Number.isFinite(numPublicExpiry) || numPublicExpiry < 0 || numPublicExpiry > 3650 ||
            !Number.isFinite(numPremiumExpiry) || numPremiumExpiry < 0 || numPremiumExpiry > 3650

        ) {

            return res.status(400).json({

                success: false,

                message: "Expiry must be a number between 0 and 3650 days."

            });

        }

        if (

            !Number.isFinite(numMaxDevices) || numMaxDevices < 1 || numMaxDevices > 100

        ) {

            return res.status(400).json({

                success: false,

                message: "Maximum devices must be a number between 1 and 100."

            });

        }

        if (

            !Number.isFinite(numLicenseLength) || numLicenseLength < 6 || numLicenseLength > 32

        ) {

            return res.status(400).json({

                success: false,

                message: "License length must be a number between 6 and 32."

            });

        }

        const settings = await Settings.findOne();

        if (!settings) {

            return res.status(404).json({

                success: false,

                message: "Settings not found."

            });

        }

        settings.license.publicExpiry = numPublicExpiry;

        settings.license.premiumExpiry = numPremiumExpiry;

        settings.license.maxDevices = numMaxDevices;

        settings.license.licenseLength = numLicenseLength;

        settings.license.autoUppercase = autoUppercase === true || autoUppercase === "true";

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

        email: req.admin.email,

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

router.get("/account/2fa/status", auth, async (req, res) => {

    try {

        const email = req.admin.email || "";

        const maskedEmail = email
            ? email.replace(/^(.{2}).+(@.+)$/, "$1***$2")
            : "";

        return res.json({

            success: true,

            enabled: req.admin.twoFactorEnabled,

            email: maskedEmail

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

router.post("/account/2fa/send-otp", auth, async (req, res) => {

    try {

        const { email } = req.body;

        const targetEmail = (email || req.admin.email || "").trim();

        if (!targetEmail) {

            return res.status(400).json({

                success: false,

                message: "Email is required to enable 2FA."

            });

        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(targetEmail)) {

            return res.status(400).json({

                success: false,

                message: "Enter a valid email address."

            });

        }

        const otp = generateOtp();

        req.admin.setupOtpCode = await hashOtp(otp);

        req.admin.setupOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

        req.admin.setupPendingEmail = targetEmail;

        await req.admin.save();

        await sendOtpEmail(targetEmail, otp);

        return res.json({

            success: true,

            message: `Verification code sent to ${targetEmail}.`

        });

    }

    catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message: error.message || "Failed to send verification code."

        });

    }

});

router.post("/account/2fa/verify", auth, async (req, res) => {

    try {

        const { otp } = req.body;

        if (!otp) {

            return res.status(400).json({

                success: false,

                message: "Verification code is required."

            });

        }

        if (

            !req.admin.setupOtpCode ||

            !req.admin.setupOtpExpiresAt ||

            req.admin.setupOtpExpiresAt < Date.now()

        ) {

            return res.status(400).json({

                success: false,

                message: "Code expired. Please request a new one."

            });

        }

        const matched = await compareOtp(otp, req.admin.setupOtpCode);

        if (!matched) {

            return res.status(401).json({

                success: false,

                message: "Invalid verification code."

            });

        }

        req.admin.twoFactorEnabled = true;

        req.admin.email = req.admin.setupPendingEmail || req.admin.email;

        req.admin.setupPendingEmail = "";

        req.admin.setupOtpCode = "";

        req.admin.setupOtpExpiresAt = null;

        await req.admin.save();

        return res.json({

            success: true,

            message: "Two-factor authentication enabled successfully."

        });

    }

    catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message: "Verification failed."

        });

    }

});

router.post("/account/2fa/disable", auth, async (req, res) => {

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

        req.admin.twoFactorEnabled = false;

        req.admin.setupOtpCode = "";

        req.admin.setupOtpExpiresAt = null;

        req.admin.setupPendingEmail = "";

        await req.admin.save();

        return res.json({

            success: true,

            message: "Two-factor authentication disabled."

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