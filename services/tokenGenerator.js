const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Settings = require("../models/Settings");
const Session = require("../models/Session");
const { getDeviceLabel } = require("./deviceLabel");

async function generateToken(admin, req, deviceId) {

const settings = await Settings.findOne();

const jwtExpiry =
    settings?.security?.jwtExpiry || "1h";

// deviceId aata hai browser ke localStorage se (persist rehta hai) -
// isliye same device ka har login isi ek session-row ko update karta
// hai, naya row nahi banta. deviceId na mile (purana client / API
// caller) to purane behaviour jaisa random id use ho jaata hai.
const sessionId = deviceId || crypto.randomUUID();

if (req) {

    const userAgent = req.headers["user-agent"] || "";

    const ip =
        req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
        req.ip ||
        "";

    try {

        await Session.findOneAndUpdate(

            { adminId: admin._id, sessionId },

            {
                $set: {
                    userAgent,
                    ip,
                    deviceLabel: getDeviceLabel(userAgent),
                    lastActiveAt: new Date()
                },
                $setOnInsert: {
                    adminId: admin._id,
                    sessionId,
                    createdAt: new Date()
                }
            },

            { upsert: true }

        );

    }

    catch (error) {

        console.error("Failed to record session:", error.message);

    }

}

return jwt.sign(

    {

        id: admin._id,

        username: admin.username,

        sessionVersion: admin.sessionVersion,

        sessionId

    },

    process.env.JWT_SECRET,

    {

        expiresIn: jwtExpiry

    }

);

}

module.exports = generateToken;