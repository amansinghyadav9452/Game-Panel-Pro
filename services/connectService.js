const License = require("../models/License");
const UserLog = require("../models/UserLog");
const md5 = require("md5");
const { resolveMarketingName } = require("./deviceLookup");
require("dotenv").config();

async function verifyLicense(body, req, expectedType = "public") {

    console.log({
    game: body.game,
    user_key: body.user_key,
    serial: body.serial,
    type: expectedType
});

    const { game, user_key, serial } = body;

    if (!process.env.TOKEN_SECRET) {

    throw new Error("TOKEN_SECRET Missing");

}

console.log("Searching:", {
    key: user_key,
    type: expectedType
});
    const license = await License.findOne({
        key: user_key,
        type: expectedType
    });
if (!license) {

    await UserLog.create({
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

if (license.expiry < new Date()) {

    await UserLog.create({
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

    await UserLog.create({
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

    await UserLog.create({
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

if (!game || !user_key) {

    await UserLog.create({
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

        await UserLog.create({
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

const recentSuccessLog = await UserLog.findOne({
    licenseKey: user_key,
    serial,
    status: "success",
    createdAt: { $gte: duplicateWindow }
}).sort({ createdAt: -1 });

if (!recentSuccessLog) {

    await UserLog.create({
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
`${game}-${user_key}-${serial}-${process.env.TOKEN_SECRET}`;

const token = md5(authString);

return {

    status: true,

    data: {

        token,

        rng,

        debug: {

            game,

            user_key,

            serial,

            authString

        }

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

    const userKey = body.user_key || "";
    const serial = body.serial || "";

    const deviceModel = body.device_model || "";
    const deviceBrand = body.device_brand || "";
    const androidVersion = body.android_version || "";

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