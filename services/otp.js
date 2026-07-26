const bcrypt = require("bcrypt");

function generateOtp() {

    return Math.floor(100000 + Math.random() * 900000).toString();

}

async function hashOtp(otp) {

    return bcrypt.hash(otp, 10);

}

async function compareOtp(otp, hashedOtp) {

    if (!otp || !hashedOtp) return false;

    return bcrypt.compare(otp, hashedOtp);

}

const OTP_TTL_MS = 5 * 60 * 1000;

module.exports = {

    generateOtp,

    hashOtp,

    compareOtp,

    OTP_TTL_MS

};
