const License = require("../models/License");
const UserLog = require("../models/UserLog");
const BannedDevice = require("../models/BannedDevice");
const KeyIndex = require("../models/KeyIndex");
const Customer = require("../models/Customer");
const md5 = require("md5");
const { resolveMarketingName } = require("./deviceLookup");
const { encryptAES, decryptAES, generateSignature } = require("./cryptoBridge");
const { getCustomerKeyModel, getCustomerActivityLogModel } = require("./customerModels");
require("dotenv").config();

// Never hardcode this key in source — this repo is public, so a literal
// value here is a leaked secret the moment it's committed. It must be
// supplied via the environment (see .env.example) and rotated if it was
// ever hardcoded previously.
function getEncryptionCode() {

    const code = process.env.CONNECT_ENCRYPTION_KEY;

    if (!code) {

        throw new Error(
            "CONNECT_ENCRYPTION_KEY Missing — set it in the server's .env file."
        );

    }

    return code;

}

// A key is valid only inside the application (Game ID) that owns it.
// Admin keys carry gameId directly; customer keys inherit the immutable
// gameId assigned to their customer account.
async function resolveLicenseDoc(key, type, gameId) {

    const normalizedGameId = String(gameId || "").trim().toUpperCase();

    if (!normalizedGameId) {
        return { doc: null, ownerCustomer: null };
    }

    const adminLicense = await License.findOne({
        key,
        type,
        gameId: normalizedGameId
    });

    if (adminLicense) {

        return { doc: adminLicense, ownerCustomer: null };

    }

    const indexEntry = await KeyIndex.findOne({ key, type });

    if (!indexEntry) {

        return { doc: null, ownerCustomer: null };

    }

    const ownerCustomer = await Customer.findById(indexEntry.customerId);

    if (!ownerCustomer || ownerCustomer.gameId !== normalizedGameId) {

        return { doc: null, ownerCustomer: null };

    }

    const CustomerKeyModel = getCustomerKeyModel(ownerCustomer._id);

    const doc = await CustomerKeyModel.findOne({ key, type });

    return { doc, ownerCustomer };

}

// Verification-attempt logs for a customer-owned key go into that
// customer's own isolated log collection instead of the shared
// UserLog, so no customer's activity ever lands in another
// collection.
async function logAttempt(ownerCustomer, data) {

    if (ownerCustomer) {

        const ActivityLog = getCustomerActivityLogModel(ownerCustomer._id);

        return ActivityLog.create(data);

    }

    return UserLog.create(data);

}

async function verifyLicense(body, req, expectedType = "public") {

    const { game, user_key, serial } = body;
    const gameId = String(game || "").trim().toUpperCase();

    if (!gameId || !user_key) {

        return {
            status: false,
            reason: "Invalid Application"
        };

    }

    if (!process.env.TOKEN_SECRET) {

    throw new Error("TOKEN_SECRET Missing");

}

    const { doc: license, ownerCustomer } = await resolveLicenseDoc(user_key, expectedType, gameId);
if (!license) {

    await logAttempt(ownerCustomer, {
    licenseKey: user_key,
    licenseType: expectedType,
    serial,
    deviceModel: body.device_model || "",
    deviceBrand: body.device_brand || "",
    androidVersion: body.android_version || "",
    status: "failed",
    reason: expectedType === "premium"
        ? "Invalid Premium Key"
        : "Invalid Public Key"
});

    return {

        status: false,

        reason:
            expectedType === "premium"
                ? "Invalid Premium Key"
                : "Invalid Public Key"

    };

}

// Key belongs to a customer whose referral access has expired or been
// disabled - verification (and therefore the game itself) must stop
// working, without touching the key/data itself.
if (ownerCustomer && (ownerCustomer.status === "disabled" || ownerCustomer.expiryAt <= new Date())) {

    await logAttempt(ownerCustomer, {
        licenseKey: user_key,
        licenseType: expectedType,
        serial,
        deviceModel: body.device_model || "",
        deviceBrand: body.device_brand || "",
        androidVersion: body.android_version || "",
        status: "failed",
        reason: "Owner Access Expired"
    });

    return {
        status: false,
        reason: "Service Unavailable"
    };

}

if (license.expiry < new Date()) {

    await logAttempt(ownerCustomer, {
    licenseKey: user_key,
    licenseType: expectedType,
    serial,
    deviceModel: body.device_model || "",
    deviceBrand: body.device_brand || "",
    androidVersion: body.android_version || "",
    status: "failed",
    reason: "License Expired"
});

    return {
        status: false,
        reason: "License Expired"
    };
}

if (license.status === "banned") {

    await logAttempt(ownerCustomer, {
    licenseKey: user_key,
    licenseType: expectedType,
    serial,
    deviceModel: body.device_model || "",
    deviceBrand: body.device_brand || "",
    androidVersion: body.android_version || "",
    status: "failed",
    reason: "License Banned"
});

    return {
        status: false,
        reason: "License Banned"
    };
}

if (!serial) {

    await logAttempt(ownerCustomer, {
    licenseKey: user_key,
    licenseType: expectedType,
    serial: "",
    deviceModel: body.device_model || "",
    deviceBrand: body.device_brand || "",
    androidVersion: body.android_version || "",
    status: "failed",
    reason: "Serial Missing"
});

    return {

        status: false,

        reason: "Serial Missing"

    };

}

const bannedDevice = await BannedDevice.findOne({
    serial
});

if (bannedDevice) {

    await logAttempt(ownerCustomer, {

        licenseKey: user_key,
        licenseType: expectedType,
        serial,
        deviceModel: body.device_model || "",
        deviceBrand: body.device_brand || "",
        androidVersion: body.android_version || "",
        status: "failed",
        reason: "Device Banned"

    });

    return {

        status: false,

        reason: "You are banned by admin."

    };

}

if (!game || !user_key) {

    await logAttempt(ownerCustomer, {
    licenseKey: user_key || "",
    licenseType: expectedType,
    serial: serial || "",
    deviceModel: body.device_model || "",
    deviceBrand: body.device_brand || "",
    androidVersion: body.android_version || "",
    status: "failed",
    reason: "Invalid Request"
});

    return {

        status: false,

        reason: "Invalid Request"

    };

}

    const alreadyRegistered = license.devices.includes(serial);

if (!alreadyRegistered) {

    if (license.devices.length >= license.maxUses) {

        await logAttempt(ownerCustomer, {
    licenseKey: user_key,
    licenseType: expectedType,
    serial,
    deviceModel: body.device_model || "",
    deviceBrand: body.device_brand || "",
    androidVersion: body.android_version || "",
    status: "failed",
    reason: "Device Limit Reached"
});

        return {
            status: false,
            reason: "Device Limit Reached"
        };

    }

    license.devices.push(serial);

    license.usedCount = license.devices.length;

}

license.lastDevice = serial;
license.lastUsed = new Date();

await license.save();

const duplicateWindow = new Date(Date.now() - 15 * 1000);

const RecentLogModel = ownerCustomer
    ? getCustomerActivityLogModel(ownerCustomer._id)
    : UserLog;

const recentSuccessLog = await RecentLogModel.findOne({
    licenseKey: user_key,
    serial,
    status: "success",
    createdAt: { $gte: duplicateWindow }
}).sort({ createdAt: -1 });

if (!recentSuccessLog) {

    await logAttempt(ownerCustomer, {
        licenseKey: user_key,
        licenseType: expectedType,
        serial,
        deviceModel: body.device_model || "",
        deviceBrand: body.device_brand || "",
        androidVersion: body.android_version || "",
        status: "success",
        reason: ""
    });

}

const rng = Math.floor(Date.now() / 1000);

const authString =
`${gameId}-${user_key}-${serial}-${process.env.TOKEN_SECRET}`;

const token = md5(authString);

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

// --- Anti-replay guard -----------------------------------------------
// The client's encrypted payload is deterministic (same key+device always
// produces the same ciphertext) and carries no nonce/timestamp of its
// own, so a captured request can otherwise be resent verbatim by an
// attacker at any rate. Since we don't control the client, we can't
// require a nonce there — instead we track the last time each decrypted
// (userKey, uuid) pair was processed and reject repeats inside a short
// cooldown window. This blocks rapid-fire replay of a captured request
// while still allowing normal, infrequent periodic license re-checks
// from the real client.
const REPLAY_WINDOW_MS = 5000;
const recentConnectRequests = new Map();

function isReplay(fingerprint) {

    const now = Date.now();
    const last = recentConnectRequests.get(fingerprint);

    // Opportunistically clear old entries so the map doesn't grow forever.
    if (recentConnectRequests.size > 5000) {

        for (const [key, ts] of recentConnectRequests) {

            if (now - ts > REPLAY_WINDOW_MS) recentConnectRequests.delete(key);

        }

    }

    if (last && now - last < REPLAY_WINDOW_MS) {

        return true;

    }

    recentConnectRequests.set(fingerprint, now);
    return false;

}

async function verifyEncryptedConnect(body, req) {

    try {

        const encryptedData = body.encryptedData;

        if (!encryptedData) {

            return {
                status: false,
                reason: "Missing encryptedData"
            };

        }

        const decryptedBase64 = decryptAES(encryptedData, getEncryptionCode());

        const decoded = Buffer.from(decryptedBase64, "base64").toString("utf8");

        const separatorIndex = decoded.lastIndexOf("_");

        if (separatorIndex === -1) {

            return {
                status: false,
                reason: "Invalid Request"
            };

        }

        const userKey = decoded.slice(0, separatorIndex);
        const uuid = decoded.slice(separatorIndex + 1);

        if (isReplay(`${userKey}:${uuid}`)) {

            return {
                status: false,
                reason: "Duplicate request detected. Please wait a moment and try again."
            };

        }

        const result = await verifyLicense(
            { game: "PUBG", user_key: userKey, serial: uuid, ...body },
            req,
            "public"
        );

        if (!result.status) {

            return result;

        }

        const license = (await resolveLicenseDoc(userKey, "public", body.game)).doc;

        const data = {

            key: userKey,

            uuid,

            expirydate: license?.expiry
                ? license.expiry.toISOString()
                : ""

        };

        const encryptionCode = getEncryptionCode();
        const dataString = JSON.stringify(data);
        const timestamp = Date.now();
        const signature = generateSignature(dataString, timestamp, encryptionCode);

        const payload = {
            timestamp,
            signature,
            dataString,
            data
        };

        const encryptedResponse = encryptAES(
            JSON.stringify(payload),
            encryptionCode
        );

        return {

            status: true,

            encryptedData: encryptedResponse

        };

    }

    catch (error) {

        console.error("Encrypted Connect Error", error);

        return {
            status: false,
            reason: "Invalid Request"
        };

    }

}

async function saveClientLog(body) {

    const userKey = body.user_key || "";
    const serial = body.serial || "";

    const deviceModel = body.device_model || "";
    const deviceBrand = body.device_brand || "";
    const androidVersion = body.android_version || "";
    const appVersion = body.app_version || "";
    const playerName = body.player_name || "";

    const resolved = await resolveMarketingName(deviceModel);
    const deviceMarketingName = resolved?.marketingName || "";

    let existingLog = null;

    if (serial) {

        existingLog = await UserLog.findOne({

            licenseKey: userKey,

            serial,

            status: "success"

        }).sort({ createdAt: -1 });

    }

    if (!existingLog) {

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
        existingLog.appVersion = appVersion;

        if (playerName) {
            existingLog.playerName = playerName;
        }

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

        deviceMarketingName,

        deviceBrand,

        androidVersion,

        appVersion,

        playerName,

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
    verifyEncryptedConnect,
    saveClientLog
};