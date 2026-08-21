const express = require("express");
const bcrypt = require("bcrypt");

const Customer = require("../models/Customer");
const BannedDevice = require("../models/BannedDevice");
const Admin = require("../models/Admin");
const Settings = require("../models/Settings");
const ReferralCode = require("../models/ReferralCode");
const KeyIndex = require("../models/KeyIndex");
const customerAuth = require("../middleware/customerAuth");
const generateCustomerToken = require("../services/customerToken");
const generateKey = require("../services/keyGenerator");
const {
    getCustomerKeyModel,
    getCustomerCrudLogModel,
    getCustomerActivityLogModel
} = require("../services/customerModels");

const router = express.Router();
const fetch = global.fetch;

// ===================== PAGE =====================

// The old standalone customer panel page has been replaced - customers
// now use the exact same pages as the admin (just role-restricted).
router.get("/customer", (req, res) => {

    res.redirect("/panel");

});

// ===================== PUBLIC =====================

// Login page calls this to check a referral code before showing the
// signup (username/password) modal.
router.get("/customer/referral/:code/check", async (req, res) => {

    try {

        const code = (req.params.code || "").trim().toUpperCase();

        const referral = await ReferralCode.findOne({ code });

        if (!referral) {

            return res.status(404).json({ success: false, message: "Invalid referral code." });

        }

        if (referral.status === "used") {

            return res.status(400).json({ success: false, message: "This referral code has already been used." });

        }

        if (referral.status === "revoked") {

            return res.status(400).json({ success: false, message: "This referral code has been revoked." });

        }

        if (referral.expiryAt <= new Date()) {

            return res.status(400).json({ success: false, message: "This referral code has expired." });

        }

        res.json({ success: true, expiryAt: referral.expiryAt });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

router.post("/customer/signup", async (req, res) => {

    try {

        const { referralCode, username, password, turnstileToken } = req.body;

        const settings = await Settings.findOne();

        if (settings?.security?.turnstileEnabled) {

            if (!turnstileToken) {
                return res.status(400).json({ success: false, message: "Captcha verification required." });
            }

            const response = await fetch(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                        secret: process.env.TURNSTILE_SECRET_KEY,
                        response: turnstileToken
                    })
                }
            );

            const result = await response.json();

            if (!result.success) {
                return res.status(400).json({ success: false, message: "Captcha verification failed." });
            }

        }

        if (!referralCode || !username || !password) {
            return res.status(400).json({
                success: false,
                message: "Referral code, username and password are all required."
            });
        }

        const cleanUsername = String(username).trim().toLowerCase();
        const code = String(referralCode).trim().toUpperCase();

        if (cleanUsername.length < 3 || cleanUsername.length > 40 ||
            typeof password !== "string" || password.length < 6 || password.length > 128) {
            return res.status(400).json({
                success: false,
                message: "Username must be 3-40 chars and password 6-128 chars."
            });
        }

        // Do not let a customer shadow an admin account name. This also keeps
        // the single /login endpoint deterministic and avoids identity ambiguity.
        const adminExists = await Admin.exists({ username: cleanUsername });
        if (adminExists) {
            return res.status(409).json({
                success: false,
                message: "That username is reserved."
            });
        }

        const referral = await ReferralCode.findOne({
            code,
            status: "active",
            expiryAt: { $gt: new Date() }
        });

        if (!referral) {
            return res.status(400).json({
                success: false,
                message: "This referral code is not valid or has expired."
            });
        }

        const existing = await Customer.findOne({ username: cleanUsername });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: "That username is already taken."
            });
        }

        const hashed = await bcrypt.hash(password, 10);

        const customer = await Customer.create({
            username: cleanUsername,
            password: hashed,
            referralCode: code,
            expiryAt: referral.expiryAt
        });

        // The conditional status check is the important part: two requests
        // cannot successfully redeem the same referral code. If another
        // request won the race, remove the just-created orphan account.
        const claimed = await ReferralCode.findOneAndUpdate(
            { _id: referral._id, status: "active", expiryAt: { $gt: new Date() } },
            {
                $set: {
                    status: "used",
                    usedBy: customer._id,
                    usedAt: new Date()
                }
            },
            { new: true }
        );

        if (!claimed) {
            await Customer.deleteOne({ _id: customer._id });
            return res.status(409).json({
                success: false,
                message: "This referral code was just used. Please use another code."
            });
        }

        // Signup ends here. The customer deliberately logs in through the
        // normal main login form, just like an admin. No second login modal.
        return res.json({
            success: true,
            username: customer.username,
            message: "Account created. Please sign in with your new credentials."
        });

    }

    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server Error" });
    }

});

router.post("/customer/login", async (req, res) => {

    try {

        const { username, password } = req.body;

        if (!username || !password) {

            return res.status(400).json({ success: false, message: "Username and password are required." });

        }

        const customer = await Customer.findOne({
            username: String(username).trim().toLowerCase()
        });

        if (!customer) {

            return res.status(401).json({ success: false, message: "Invalid username or password." });

        }

        if (customer.lockUntil && customer.lockUntil > new Date()) {

            return res.status(423).json({ success: false, message: "Account temporarily locked. Try again later." });

        }

        const match = await bcrypt.compare(password, customer.password);

        if (!match) {

            customer.failedAttempts = (customer.failedAttempts || 0) + 1;

            if (customer.failedAttempts >= 6) {

                customer.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
                customer.failedAttempts = 0;

            }

            await customer.save();

            return res.status(401).json({ success: false, message: "Invalid username or password." });

        }

        if (customer.status === "disabled") {

            return res.status(403).json({ success: false, message: "Your account has been disabled by admin." });

        }

        if (customer.expiryAt <= new Date()) {

            return res.status(403).json({
                success: false,
                message: "Your referral access has expired. Contact admin for a new code."
            });

        }

        customer.failedAttempts = 0;
        customer.lockUntil = null;
        customer.lastLoginAt = new Date();

        await customer.save();

        const token = generateCustomerToken(customer);

        res.json({ success: true, token });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

// ===================== PROTECTED =====================

router.get("/customer/me", customerAuth, async (req, res) => {

    try {

        // The sidebar is shared with the admin panel. Customers should
        // see the same public panel identity (display name + profile
        // picture) that the admin has configured, without exposing any
        // admin account credentials or private settings.
        const settings = await Settings.findOne().select("panelProfile").lean();

        const panelProfile = settings?.panelProfile || {};

        res.json({

            success: true,

            customer: {
                username: req.customer.username,
                expiryAt: req.customer.expiryAt,
                status: req.customer.status,
                createdAt: req.customer.createdAt
            },

            panelProfile: {
                displayName: panelProfile.displayName || "Administrator",
                profileImage: panelProfile.profileImage || ""
            }

        });

    } catch (err) {

        console.error("Customer profile load error:", err);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

});

router.get("/customer/keys", customerAuth, async (req, res) => {

    try {

        const KeyModel = getCustomerKeyModel(req.customer._id);

        const type = req.query.type;

        const filter = type ? { type } : {};

        const keys = await KeyModel.find(filter).sort({ createdAt: -1 }).lean();

        res.json({ success: true, keys });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

router.post("/customer/keys", customerAuth, async (req, res) => {

    try {

        const { type, expiryDays, maxUses } = req.body;

        if (!["public", "premium"].includes(type)) {

            return res.status(400).json({ success: false, message: "type must be public or premium." });

        }

        const days = Number(expiryDays);

        if (!Number.isFinite(days) || days <= 0) {

            return res.status(400).json({ success: false, message: "Valid expiryDays is required." });

        }

        const KeyModel = getCustomerKeyModel(req.customer._id);

        let key = generateKey(type);

        while (await KeyIndex.findOne({ key })) {
            key = generateKey(type);
        }

        const expiry = new Date();
        expiry.setDate(expiry.getDate() + days);

        const doc = await KeyModel.create({
            key,
            type,
            expiry,
            maxUses: Number(maxUses) > 0 ? Number(maxUses) : 1
        });

        await KeyIndex.create({ key, type, customerId: req.customer._id });

        const CrudLog = getCustomerCrudLogModel(req.customer._id);

        await CrudLog.create({
            action: "created",
            key,
            type,
            details: `Created with ${days}d expiry`
        });

        res.json({ success: true, key: doc });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

async function findOwnKey(req, res) {

    const KeyModel = getCustomerKeyModel(req.customer._id);

    const doc = await KeyModel.findOne({ key: req.params.key });

    if (!doc) {

        res.status(404).json({ success: false, message: "Key not found." });

        return null;

    }

    return doc;

}

router.put("/customer/keys/:key/ban", customerAuth, async (req, res) => {

    try {

        const doc = await findOwnKey(req, res);

        if (!doc) return;

        doc.status = "banned";
        doc.banReason = req.body?.reason || "";

        await doc.save();

        const CrudLog = getCustomerCrudLogModel(req.customer._id);

        await CrudLog.create({ action: "banned", key: doc.key, type: doc.type });

        res.json({ success: true, key: doc });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

router.put("/customer/keys/:key/unban", customerAuth, async (req, res) => {

    try {

        const doc = await findOwnKey(req, res);

        if (!doc) return;

        doc.status = doc.expiry > new Date() ? "active" : "expired";
        doc.banReason = "";

        await doc.save();

        const CrudLog = getCustomerCrudLogModel(req.customer._id);

        await CrudLog.create({ action: "unbanned", key: doc.key, type: doc.type });

        res.json({ success: true, key: doc });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

router.put("/customer/keys/:key/extend", customerAuth, async (req, res) => {

    try {

        const days = Number(req.body?.expiryDays);

        if (!Number.isFinite(days) || days <= 0) {

            return res.status(400).json({ success: false, message: "Valid expiryDays is required." });

        }

        const doc = await findOwnKey(req, res);

        if (!doc) return;

        const base = doc.expiry > new Date() ? doc.expiry : new Date();

        base.setDate(base.getDate() + days);

        doc.expiry = base;

        if (doc.status === "expired") doc.status = "active";

        await doc.save();

        const CrudLog = getCustomerCrudLogModel(req.customer._id);

        await CrudLog.create({ action: "extended", key: doc.key, type: doc.type, details: `+${days}d` });

        res.json({ success: true, key: doc });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

router.put("/customer/keys/:key/reset-device", customerAuth, async (req, res) => {

    try {

        const doc = await findOwnKey(req, res);

        if (!doc) return;

        doc.devices = [];
        doc.usedCount = 0;
        doc.lastDevice = null;

        await doc.save();

        const CrudLog = getCustomerCrudLogModel(req.customer._id);

        await CrudLog.create({ action: "reset-device", key: doc.key, type: doc.type });

        res.json({ success: true, key: doc });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

router.delete("/customer/keys/:key", customerAuth, async (req, res) => {

    try {

        const KeyModel = getCustomerKeyModel(req.customer._id);

        const doc = await KeyModel.findOneAndDelete({ key: req.params.key });

        if (!doc) {

            return res.status(404).json({ success: false, message: "Key not found." });

        }

        await KeyIndex.deleteOne({ key: doc.key, customerId: req.customer._id });

        const CrudLog = getCustomerCrudLogModel(req.customer._id);

        await CrudLog.create({ action: "deleted", key: doc.key, type: doc.type });

        res.json({ success: true });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

// ===================== CUSTOMER BANNED DEVICES =====================

// Customers may only see devices they personally banned. Admin-created
// bans are deliberately excluded from this endpoint.
router.get("/customer/banned-devices", customerAuth, async (req, res) => {

    try {

        const devices = await BannedDevice
            .find({ ownerCustomer: req.customer._id })
            .sort({ bannedAt: -1 })
            .lean();

        res.json({ success: true, devices });

    }

    catch (err) {

        console.error(err);
        res.status(500).json({ success: false, message: "Server Error" });

    }

});

router.post("/customer/banned-devices/ban", customerAuth, async (req, res) => {

    try {

        const {
            serial,
            userKey,
            deviceBrand,
            deviceModel,
            androidVersion,
            appVersion,
            playerName,
            reason
        } = req.body;

        const cleanSerial = String(serial || "").trim();
        const cleanKey = String(userKey || "").trim();

        if (!cleanSerial || !cleanKey) {
            return res.status(400).json({
                success: false,
                message: "Serial and license key are required."
            });
        }

        // A customer can only ban a device that is associated with one of
        // their own keys. The key is taken from the customer's isolated key
        // collection, so another customer's/admin key cannot be targeted.
        const KeyModel = getCustomerKeyModel(req.customer._id);
        const ownKey = await KeyModel.findOne({ key: cleanKey }).lean();

        if (!ownKey) {
            return res.status(403).json({
                success: false,
                message: "You can only ban devices related to your own keys."
            });
        }

        const existing = await BannedDevice.findOne({ serial: cleanSerial }).lean();

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "Device already banned."
            });
        }

        const banned = await BannedDevice.create({
            ownerCustomer: req.customer._id,
            serial: cleanSerial,
            userKey: cleanKey,
            deviceBrand: String(deviceBrand || ""),
            deviceModel: String(deviceModel || ""),
            androidVersion: String(androidVersion || ""),
            appVersion: String(appVersion || ""),
            playerName: String(playerName || ""),
            bannedBy: req.customer.username,
            reason: String(reason || "No reason provided").slice(0, 200)
        });

        const CrudLog = getCustomerCrudLogModel(req.customer._id);
        await CrudLog.create({
            action: "device_banned",
            key: cleanKey,
            type: ownKey.type,
            details: `Device ${cleanSerial} banned${reason ? `: ${String(reason).slice(0, 200)}` : ""}`
        });

        res.json({ success: true, banned });

    }

    catch (err) {

        console.error(err);
        res.status(500).json({ success: false, message: "Server Error" });

    }

});

router.delete("/customer/banned-devices/:serial", customerAuth, async (req, res) => {

    try {

        const serial = String(req.params.serial || "").trim();

        const result = await BannedDevice.deleteOne({
            serial,
            ownerCustomer: req.customer._id
        });

        if (!result.deletedCount) {
            return res.status(404).json({
                success: false,
                message: "Banned device not found in your own bans."
            });
        }

        res.json({ success: true });

    }

    catch (err) {

        console.error(err);
        res.status(500).json({ success: false, message: "Server Error" });

    }

});

router.get("/customer/logs/crud", customerAuth, async (req, res) => {

    try {

        const CrudLog = getCustomerCrudLogModel(req.customer._id);

        const logs = await CrudLog.find({}).sort({ createdAt: -1 }).limit(200).lean();

        res.json({ success: true, logs });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

router.get("/customer/logs/activity", customerAuth, async (req, res) => {

    try {

        const ActivityLog = getCustomerActivityLogModel(req.customer._id);

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 200));

        const [logs, totalLogs] = await Promise.all([

            ActivityLog.find({})
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),

            ActivityLog.countDocuments({})

        ]);

        res.json({ success: true, logs, currentPage: page, totalLogs });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

// =====================================================================
// The endpoints below exist purely so the customer panel can reuse the
// exact same pages/scripts (dashboard, public-keys, premium-keys) as
// the admin panel — same response shape (`licenses`/`license` instead
// of `keys`/`key`), but every query below is always scoped to
// req.customer._id server-side. There is no parameter a customer can
// pass to reach another customer's or the admin's data.
// =====================================================================

router.get("/customer/dashboard/stats", customerAuth, async (req, res) => {

    try {

        const KeyModel = getCustomerKeyModel(req.customer._id);

        const counts = await KeyModel.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);

        let activeKeys = 0, expiredKeys = 0, bannedKeys = 0;

        for (const row of counts) {

            if (row._id === "banned") bannedKeys = row.count;
            else if (row._id === "expired") expiredKeys = row.count;
            else if (row._id === "active") activeKeys = row.count;

        }

        const totalKeys = activeKeys + expiredKeys + bannedKeys;

        res.json({

            success: true,

            stats: { totalKeys, activeKeys, expiredKeys, bannedKeys }

        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

router.get("/customer/dashboard/recent-activity", customerAuth, async (req, res) => {

    try {

        const CrudLog = getCustomerCrudLogModel(req.customer._id);

        const logs = await CrudLog.find({}).sort({ createdAt: -1 }).limit(20).lean();

        const actionMap = {
            created: "CREATE",
            banned: "BAN",
            unbanned: "UNBAN",
            extended: "EXTEND",
            "reset-device": "RESET_DEVICE",
            deleted: "DELETE"
        };

        const activities = logs.map(l => ({

            action: actionMap[l.action] || l.action,
            licenseKey: l.key,
            licenseType: l.type,
            admin: req.customer.username,
            createdAt: l.createdAt

        }));

        res.json({ success: true, activities });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

function keyToLicenseShape(k) {

    return {

        key: k.key,
        type: k.type,
        status: k.status,
        expiry: k.expiry,
        lastUsed: k.lastUsed,
        maxUses: k.maxUses,
        usedCount: k.usedCount,
        devices: k.devices,
        lastDevice: k.lastDevice,
        banReason: k.banReason,
        createdAt: k.createdAt

    };

}

async function listByType(req, res, type) {

    try {

        const KeyModel = getCustomerKeyModel(req.customer._id);

        const keys = await KeyModel.find({ type }).sort({ createdAt: -1 }).lean();

        res.json({ success: true, licenses: keys.map(keyToLicenseShape) });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

}

router.get("/customer/public/list", customerAuth, (req, res) => listByType(req, res, "public"));
router.get("/customer/premium/list", customerAuth, (req, res) => listByType(req, res, "premium"));

router.get("/customer/dashboard/license/:key", customerAuth, async (req, res) => {

    try {

        const KeyModel = getCustomerKeyModel(req.customer._id);

        const doc = await KeyModel.findOne({ key: req.params.key }).lean();

        if (!doc) {

            return res.status(404).json({ success: false, message: "License Not Found" });

        }

        res.json({ success: true, license: keyToLicenseShape(doc) });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

// Static, reasonable defaults - customers don't have their own
// Settings document, so the create-key form just prefills with these
// instead of the admin's configured License Settings.
router.get("/customer/license/config", customerAuth, (req, res) => {

    res.json({

        success: true,

        license: {
            publicExpiry: 30,
            premiumExpiry: 30,
            maxDevices: 1
        }

    });

});

router.get("/customer/license/generate-key", customerAuth, (req, res) => {

    const type = req.query.type === "premium" ? "premium" : "public";

    res.json({ success: true, key: generateKey(type) });

});

async function createByType(req, res, type) {

    try {

        const expiryDays = Number(req.body.expiryDays);
        const maxUses = Number(req.body.maxUses);

        const days = Number.isFinite(expiryDays) && expiryDays > 0 ? expiryDays : 30;
        const uses = Number.isFinite(maxUses) && maxUses > 0 ? maxUses : 1;

        const KeyModel = getCustomerKeyModel(req.customer._id);

        let key = req.body.key
            ? String(req.body.key).trim().toUpperCase()
            : generateKey(type);

        while (await KeyIndex.findOne({ key })) {
            key = generateKey(type);
        }

        const expiry = new Date();
        expiry.setDate(expiry.getDate() + days);

        const doc = await KeyModel.create({ key, type, expiry, maxUses: uses });

        await KeyIndex.create({ key, type, customerId: req.customer._id });

        const CrudLog = getCustomerCrudLogModel(req.customer._id);

        await CrudLog.create({ action: "created", key, type, details: `Created with ${days}d expiry` });

        res.json({ success: true, message: "License Created Successfully", license: keyToLicenseShape(doc) });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

}

router.post("/customer/public/create", customerAuth, (req, res) => createByType(req, res, "public"));
router.post("/customer/premium/create", customerAuth, (req, res) => createByType(req, res, "premium"));

async function findOwnKeyByParam(req, res) {

    const KeyModel = getCustomerKeyModel(req.customer._id);

    const doc = await KeyModel.findOne({ key: req.params.key });

    if (!doc) {

        res.status(404).json({ success: false, message: "License Not Found" });

        return null;

    }

    return doc;

}

router.put("/customer/dashboard/ban/:key", customerAuth, async (req, res) => {

    try {

        const doc = await findOwnKeyByParam(req, res);

        if (!doc) return;

        doc.status = "banned";

        await doc.save();

        const CrudLog = getCustomerCrudLogModel(req.customer._id);

        await CrudLog.create({ action: "banned", key: doc.key, type: doc.type });

        res.json({ success: true, message: "License Banned Successfully" });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

router.put("/customer/dashboard/unban/:key", customerAuth, async (req, res) => {

    try {

        const doc = await findOwnKeyByParam(req, res);

        if (!doc) return;

        doc.status = doc.expiry > new Date() ? "active" : "expired";
        doc.banReason = "";

        await doc.save();

        const CrudLog = getCustomerCrudLogModel(req.customer._id);

        await CrudLog.create({ action: "unbanned", key: doc.key, type: doc.type });

        res.json({ success: true, message: "License Unbanned Successfully" });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

router.put("/customer/dashboard/extend/:key", customerAuth, async (req, res) => {

    try {

        const mode = req.body.mode === "device" ? "device" : "license";
        const value = Number(req.body.value !== undefined ? req.body.value : req.body.days);

        if (!Number.isFinite(value) || value <= 0) {

            return res.status(400).json({ success: false, message: "Enter a valid positive number." });

        }

        const doc = await findOwnKeyByParam(req, res);

        if (!doc) return;

        if (mode === "device") {

            const addCount = Math.min(100, Math.floor(value));

            doc.maxUses = (doc.maxUses || 0) + addCount;

            await doc.save();

            return res.json({ success: true, message: "Device Limit Extended Successfully", maxUses: doc.maxUses });

        }

        const base = doc.expiry > new Date() ? doc.expiry : new Date();

        base.setDate(base.getDate() + Math.floor(value));

        doc.expiry = base;
        doc.status = "active";

        await doc.save();

        const CrudLog = getCustomerCrudLogModel(req.customer._id);

        await CrudLog.create({ action: "extended", key: doc.key, type: doc.type, details: `+${Math.floor(value)}d` });

        res.json({ success: true, message: "License Extended Successfully", expiry: doc.expiry });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

router.put("/customer/dashboard/reset-device/:key", customerAuth, async (req, res) => {

    try {

        const doc = await findOwnKeyByParam(req, res);

        if (!doc) return;

        doc.devices = [];
        doc.usedCount = 0;
        doc.lastDevice = null;

        await doc.save();

        const CrudLog = getCustomerCrudLogModel(req.customer._id);

        await CrudLog.create({ action: "reset-device", key: doc.key, type: doc.type });

        res.json({ success: true, message: "Device Reset Successfully" });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

async function deleteByType(req, res) {

    try {

        const KeyModel = getCustomerKeyModel(req.customer._id);

        const doc = await KeyModel.findOneAndDelete({ key: req.params.key });

        if (!doc) {

            return res.status(404).json({ success: false, message: "License Not Found" });

        }

        await KeyIndex.deleteOne({ key: doc.key, customerId: req.customer._id });

        const CrudLog = getCustomerCrudLogModel(req.customer._id);

        await CrudLog.create({ action: "deleted", key: doc.key, type: doc.type });

        res.json({ success: true, message: "License Deleted Successfully" });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

}

router.delete("/customer/public/delete/:key", customerAuth, deleteByType);
router.delete("/customer/premium/delete/:key", customerAuth, deleteByType);

module.exports = router;
