const jwt = require("jsonwebtoken");
const Settings = require("../models/Settings");

async function generateToken(admin) {

const settings = await Settings.findOne();

const jwtExpiry =
    settings?.security?.jwtExpiry || "1h";

return jwt.sign(

    {

        id: admin._id,

        username: admin.username,

        sessionVersion: admin.sessionVersion

    },

    process.env.JWT_SECRET,

    {

        expiresIn: jwtExpiry

    }

);

}

module.exports = generateToken;