const License = require("../models/License");
const md5 = require("md5");
require("dotenv").config();

async function verifyLicense(body, req, expectedType = "public") {

    const { game, user_key, serial } = body;

    if (!process.env.TOKEN_SECRET) {

    throw new Error("TOKEN_SECRET Missing");

}

    const license = await License.findOne({
        key: user_key,
        type: expectedType
    });
if (!license) {

    return {

        status: false,

        reason:
            expectedType === "premium"
                ? "Invalid Premium Key"
                : "Invalid Public Key"

    };

}

if (license.expiry < new Date()) {
    return {
        status: false,
        reason: "License Expired"
    };
}

if (license.status === "banned") {
    return {
        status: false,
        reason: "License Banned"
    };
} 

if (!serial) {

    return {

        status: false,

        reason: "Serial Missing"

    };

}

if (!game || !user_key) {

    return {

        status: false,

        reason: "Invalid Request"

    };

}
  
    const alreadyRegistered = license.devices.includes(serial);

if (!alreadyRegistered) {

    if (license.devices.length >= license.maxUses) {

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

module.exports = verifyLicense;