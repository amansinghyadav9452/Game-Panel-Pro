const License = require("../models/License");
const UserLog = require("../models/UserLog");
const md5 = require("md5");
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

    await UserLog.create({

        licenseKey: body.user_key || "",

        licenseType: body.license_type || "public",

        serial: body.serial || "",

        deviceModel: body.device_model || "",

        deviceBrand: body.device_brand || "",

        androidVersion: body.android_version || "",

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