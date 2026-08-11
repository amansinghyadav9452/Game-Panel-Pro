const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Settings = require("../models/Settings");
const Session = require("../models/Session");
const { getDeviceLabel } = require("./deviceLabel");

async function generateToken(admin, req) {

const settings = await Settings.findOne();

const jwtExpiry =
    settings?.security?.jwtExpiry || "1h";

const sessionId = crypto.randomUUID();

if (req) {

    const userAgent = req.headers["user-agent"] || "";

    const ip =
        req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
        req.ip ||
        "";

    try {

        await Session.create({
            adminId: admin._id,
            sessionId,
            userAgent,
            ip,
            deviceLabel: getDeviceLabel(userAgent)
        });

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