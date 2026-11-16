const License = require("../models/License");
const UserLog = require("../models/UserLog");
const DailyVerificationStat = require("../models/DailyVerificationStat");
const BannedDevice = require("../models/BannedDevice");
const KeyIndex = require("../models/KeyIndex");
const Customer = require("../models/Customer");
const GameApplication = require("../models/GameApplication");
const md5 = require("md5");
const { isReplay: isRedisReplay } = require("../config/redisRest");
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


// Store exact daily verification request counts in India-local calendar days.
// This counter is independent of UserLog's 15-second success-log deduplication.
function indiaDayKey(date = new Date()) {
    return new Date(date.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

async function recordVerificationRequest(body = {}) {
    const dayKey = indiaDayKey();
    const gameId = String(body.game || body.game_id || "").trim().toUpperCase();
    let ownerKey = "unattributed";
    let ownerType = "unattributed";
    let customerId = null;

    // Attribute requests from the registered application, never from a
    // client-supplied customer ID. Unknown Game IDs must not pollute Admin.
    if (gameId) {
        const application = await GameApplication.findOne({ gameId }).select("ownerType customerId").lean();
        if (application?.ownerType === "admin") {
            ownerKey = "admin";
            ownerType = "admin";
        } else if (application?.ownerType === "customer" && application.customerId) {
            customerId = String(application.customerId);
            ownerKey = `customer:${customerId}`;
            ownerType = "customer";
        }
    }

    const filter = { dayKey, ownerKey };
    const update = {
        $inc: { requestCount: 1 },
        $setOnInsert: { dayKey, ownerKey, ownerType, customerId, gameId }
    };
    try {
        await DailyVerificationStat.updateOne(filter, update, { upsert: true });
    } catch (error) {
        if (error && error.code === 11000) {
            await DailyVerificationStat.updateOne(filter, { $inc: { requestCount: 1 } });
        } else {
            throw error;
        }
    }

    // Push a scoped event only after the request count is persisted.
    // Dashboards refresh on actual verification traffic, not on a timer.
    require("./realtime").emitVerificationRequest(ownerType, customerId);
}

// A key is valid only inside the application (Game ID) that owns it.
// Admin keys carry gameId directly; customer keys inherit the immutable
// gameId assigned to their customer account.
async function resolveLicenseDoc(key, type, gameId) {
    const normalizedGameId = String(gameId || "").trim().toUpperCase();
    if (!normalizedGameId) return { doc: null, ownerCustomer: null, ownerType: "unattributed" };

    // Application ownership determines the log destination even when the
    // supplied key is invalid. This prevents customer failures falling back
    // into the shared Admin UserLog collection.
    const application = await GameApplication.findOne({ gameId: normalizedGameId }).lean();
    if (!application) return { doc: null, ownerCustomer: null, ownerType: "unattributed" };

    if (application.ownerType === "customer") {
        const ownerCustomer = await Customer.findById(application.customerId);
        if (!ownerCustomer || ownerCustomer.gameId !== normalizedGameId) {
            return { doc: null, ownerCustomer: null, ownerType: "unattributed" };
        }
        if (application.status !== "active") return { doc: null, ownerCustomer, ownerType: "customer" };
        const indexEntry = await KeyIndex.findOne({ key, type, customerId: ownerCustomer._id });
        if (!indexEntry) return { doc: null, ownerCustomer, ownerType: "customer" };
        const CustomerKeyModel = getCustomerKeyModel(ownerCustomer._id);
        const doc = await CustomerKeyModel.findOne({ key, type });
        return { doc, ownerCustomer, ownerType: "customer" };
    }

    if (application.status !== "active") return { doc: null, ownerCustomer: null, ownerType: "admin" };
    const doc = await License.findOne({ key, type, gameId: normalizedGameId });
    return { doc, ownerCustomer: null, ownerType: "admin" };
}

// Verification-attempt logs for a customer-owned key go into that
// customer's own isolated log collection instead of the shared
// UserLog, so no customer's activity ever lands in another
// collection.
async function logAttempt(ownerCustomer, data, ownerType = "admin") {

    if (ownerType === "unattributed") return null;

    if (ownerType === "customer" && ownerCustomer) {

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

    const { doc: license, ownerCustomer, ownerType } = await resolveLicenseDoc(user_key, expectedType, gameId);
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
}, ownerType);

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
    }, ownerType);

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
}, ownerType);

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
}, ownerType);

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
}, ownerType);

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

    }, ownerType);

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
}, ownerType);

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
}, ownerType);

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
    }, ownerType);

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

async function isReplay(fingerprint) {
    try {
        return await isRedisReplay(fingerprint, REPLAY_WINDOW_MS);
    } catch (_) {
        // Redis helper has its own in-memory fallback. Keep a final local
        // guard here as a defensive fallback if that helper ever changes.
        const now = Date.now();
        const last = recentConnectRequests.get(fingerprint);
        if (recentConnectRequests.size > 5000) {
            for (const [key, timestamp] of recentConnectRequests) {
                if (now - timestamp > REPLAY_WINDOW_MS) recentConnectRequests.delete(key);
            }
        }
        if (last && now - last < REPLAY_WINDOW_MS) return true;
        recentConnectRequests.set(fingerprint, now);
        return false;
    }
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

        if (await isReplay(`${userKey}:${uuid}`)) {

            return {
                status: false,
                reason: "Duplicate request detected. Please wait a moment and try again."
            };

        }

        const gameId = String(body.game || "").trim().toUpperCase();

        if (!gameId) {
            return {
                status: false,
                reason: "Invalid Application"
            };
        }

        const result = await verifyLicense(
            { game: gameId, user_key: userKey, serial: uuid, ...body },
            req,
            "public"
        );

        if (!result.status) {

            return result;

        }

        const license = (await resolveLicenseDoc(userKey, "public", gameId)).doc;

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

async function saveClientLog(body = {}) {
    const userKey = String(body.user_key || "").trim();
    const serial = String(body.serial || "").trim();
    if (!userKey) return { status: false, reason: "Missing key" };

    const deviceModel = body.device_model || "";
    const deviceBrand = body.device_brand || "";
    const androidVersion = body.android_version || "";
    const appVersion = body.app_version || "";
    const playerName = body.player_name || "";
    const resolved = await resolveMarketingName(deviceModel);
    const deviceMarketingName = resolved?.marketingName || "";

    // KeyIndex is the authoritative owner mapping for customer keys.
    const indexEntry = await KeyIndex.findOne({ key: userKey }).lean();
    let LogModel = UserLog;
    if (indexEntry?.customerId) {
        const customer = await Customer.findById(indexEntry.customerId).select("_id gameId status expiryAt").lean();
        if (!customer) return { status: false, reason: "Key owner unavailable" };
        LogModel = getCustomerActivityLogModel(customer._id);
    } else {
        const adminLicense = await License.exists({ key: userKey });
        if (!adminLicense) return { status: false, reason: "Key not found" };
    }

    let existingLog = null;
    if (serial) {
        existingLog = await LogModel.findOne({ licenseKey: userKey, serial, status: "success" }).sort({ createdAt: -1 });
    }
    if (!existingLog) {
        const recentCutoff = new Date(Date.now() - 5 * 60 * 1000);
        existingLog = await LogModel.findOne({
            licenseKey: userKey, status: "success", createdAt: { $gte: recentCutoff },
            $or: [{ deviceModel: { $in: [null, ""] } }, { deviceModel: { $exists: false } }]
        }).sort({ createdAt: -1 });
    }

    const fields = { deviceModel, deviceMarketingName, deviceBrand, androidVersion, appVersion };
    if (playerName) fields.playerName = playerName;
    if (serial) fields.serial = serial;
    if (existingLog) {
        Object.assign(existingLog, fields);
        await existingLog.save();
        return { status: true, message: "Log Merged" };
    }

    await LogModel.create({
        licenseKey: userKey, licenseType: body.license_type || "public", serial,
        ...fields, playerName, status: body.status || "success", reason: body.reason || ""
    });
    return { status: true, message: "Log Saved" };
}

module.exports = {
    verifyPublicLicense,
    verifyPremiumLicense,
    verifyEncryptedConnect,
    recordVerificationRequest,
    saveClientLog
};