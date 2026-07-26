const crypto = require("crypto");
const License = require("../models/License");
const UserLog = require("../models/UserLog");
const { resolveMarketingName } = require("./deviceLookup");
const bruteForceGuard = require("./bruteForceGuard");
require("dotenv").config();

const AUTO_BAN_THRESHOLD = 10;
const AUTO_BAN_WINDOW_MS = 30 * 60 * 1000;

function isNonEmptyString(value) {

    return typeof value === "string" && value.trim().length > 0;

}

function getClientIp(req) {

    return (req && req.ip) || "unknown";

}

async function logAttempt(user_key, expectedType, serial, body, status, reason, ip) {

    await UserLog.create({

        licenseKey: isNonEmptyString(user_key) ? user_key : "",
        licenseType: expectedType,
        serial: isNonEmptyString(serial) ? serial : "",
        deviceModel: isNonEmptyString(body.device_model) ? body.device_model : "",
        deviceBrand: isNonEmptyString(body.device_brand) ? body.device_brand : "",
        androidVersion: isNonEmptyString(body.android_version) ? body.android_version : "",
        ip,
        status,
        reason

    });

}

async function registerLicenseFailure(license) {

    const now = new Date();
    const windowStart = new Date(now.getTime() - AUTO_BAN_WINDOW_MS);

    if (license.lastFailedAt && license.lastFailedAt < windowStart) {

        license.failedAttempts = 0;

    }

    license.failedAttempts += 1;
    license.lastFailedAt = now;

    if (license.failedAttempts >= AUTO_BAN_THRESHOLD) {

        license.status = "banned";
        license.banReason =
            "Auto-banned: repeated device-limit violations (possible key sharing).";

    }

    await license.save();

}

async function verifyLicense(body, req, expectedType = "public") {

    const ip = getClientIp(req);
    body = body || {};

    if (bruteForceGuard.isBlocked(ip)) {

        return {

            status: false,

            reason: "Too many failed attempts. Try again later."

        };

    }

    if (!process.env.TOKEN_SECRET) {

        throw new Error("TOKEN_SECRET Missing");

    }

    const { game, user_key, serial } = body;

    // Reject anything that isn't a plain non-empty string up front - this
    // is what stops NoSQL-operator-object injection (e.g. user_key sent
    // as {"$ne": null}) from ever reaching a Mongoose query.
    if (!isNonEmptyString(user_key)) {

        bruteForceGuard.recordFailure(ip);

        const reason =
            expectedType === "premium"
                ? "Invalid Premium Key"
                : "Invalid Public Key";

        await logAttempt(user_key, expectedType, serial, body, "failed", reason, ip);

        return { status: false, reason };

    }

    const license = await License.findOne({

        key: user_key,
        type: expectedType

    });

    if (!license) {

        bruteForceGuard.recordFailure(ip);

        const reason =
            expectedType === "premium"
                ? "Invalid Premium Key"
                : "Invalid Public Key";

        await logAttempt(user_key, expectedType, serial, body, "failed", reason, ip);

        return { status: false, reason };

    }

    if (license.expiry < new Date()) {

        await logAttempt(user_key, expectedType, serial, body, "failed", "License Expired", ip);

        return { status: false, reason: "License Expired" };

    }

    if (license.status === "banned") {

        await logAttempt(user_key, expectedType, serial, body, "failed", "License Banned", ip);

        return { status: false, reason: "License Banned" };

    }

    if (!isNonEmptyString(serial)) {

        bruteForceGuard.recordFailure(ip);

        await logAttempt(user_key, expectedType, serial, body, "failed", "Serial Missing", ip);

        return { status: false, reason: "Serial Missing" };

    }

    if (!isNonEmptyString(game)) {

        bruteForceGuard.recordFailure(ip);

        await logAttempt(user_key, expectedType, serial, body, "failed", "Invalid Request", ip);

        return { status: false, reason: "Invalid Request" };

    }

    const alreadyRegistered = license.devices.includes(serial);

    if (!alreadyRegistered && license.devices.length >= license.maxUses) {

        await registerLicenseFailure(license);

        await logAttempt(user_key, expectedType, serial, body, "failed", "Device Limit Reached", ip);

        return { status: false, reason: "Device Limit Reached" };

    }

    if (!alreadyRegistered) {

        license.devices.push(serial);
        license.usedCount = license.devices.length;

    }

    license.lastDevice = serial;
    license.lastUsed = new Date();
    license.failedAttempts = 0;
    license.lastFailedAt = null;

    await license.save();

    bruteForceGuard.recordSuccess(ip);

    const duplicateWindow = new Date(Date.now() - 15 * 1000);

    const recentSuccessLog = await UserLog.findOne({

        licenseKey: user_key,
        serial,
        status: "success",
        createdAt: { $gte: duplicateWindow }

    }).sort({ createdAt: -1 });

    if (!recentSuccessLog) {

        await logAttempt(user_key, expectedType, serial, body, "success", "", ip);

    }

    const rng = Math.floor(Date.now() / 1000);

    // HMAC-SHA256 with the secret used as the *key* (not concatenated
    // into the message) - this is the correct construction and is not
    // vulnerable to length-extension attacks the way MD5(secret+data) is.
    const token = crypto

        .createHmac("sha256", process.env.TOKEN_SECRET)

        .update(`${game}-${user_key}-${serial}`)

        .digest("hex");

    return {

        status: true,

        data: {

            token,

            rng

        }

    };

}

async function verifyPremiumLicense(body, req) {
    return verifyLicense(body, req, "premium");
}

async function verifyPublicLicense(body, req) {
    return verifyLicense(body, req, "public");
}

async function saveClientLog(body) {

    body = body || {};

    const userKey = isNonEmptyString(body.user_key) ? body.user_key : "";
    const serial = isNonEmptyString(body.serial) ? body.serial : "";

    const deviceModel = isNonEmptyString(body.device_model) ? body.device_model : "";
    const deviceBrand = isNonEmptyString(body.device_brand) ? body.device_brand : "";
    const androidVersion = isNonEmptyString(body.android_version) ? body.android_version : "";

    const resolved = await resolveMarketingName(deviceModel);
    const deviceMarketingName = resolved?.marketingName || "";

    let existingLog = null;

    if (serial) {

        // Exact match: same license key + same device serial.
        existingLog = await UserLog.findOne({

            licenseKey: userKey,

            serial,

            status: "success"

        }).sort({ createdAt: -1 });

    }

    if (!existingLog) {

        // Fallback for older clients that don't send a serial yet:
        // merge into the most recent unmatched success log for this key.
        const recentCutoff = new Date(Date.now() - 5 * 60 * 1000);

        existingLog = await UserLog.findOne({

            licenseKey: userKey,

            status: "success",

            createdAt: { $gte: recentCutoff },

            $or: [

                { deviceModel: { $in: [null, ""] } },

                { deviceModel: { $exists: false } }

            ]

        }).sort({ createdAt: -1 });

    }

    if (existingLog) {

        existingLog.deviceModel = deviceModel;
        existingLog.deviceMarketingName = deviceMarketingName;
        existingLog.deviceBrand = deviceBrand;
        existingLog.androidVersion = androidVersion;

        if (serial) {
            existingLog.serial = serial;
        }

        await existingLog.save();

        return {

            status: true,

            message: "Log Merged"

        };

    }

    await UserLog.create({

        licenseKey: userKey,

        licenseType: body.license_type || "public",

        serial,

        deviceModel,

        androidVersion,

        deviceMarketingName,

        deviceBrand,

        status: body.status || "success",

        reason: body.reason || ""

    });

    return {

        status: true,

        message: "Log Saved"

    };

}

module.exports = {
    verifyPublicLicense,
    verifyPremiumLicense,
    saveClientLog
};
