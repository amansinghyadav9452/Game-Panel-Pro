const express = require("express");
const bcrypt = require("bcrypt");

const Admin = require("../models/Admin");
const Settings = require("../models/Settings");
const generateToken = require("../services/tokenGenerator");
const { generateOtp, hashOtp, compareOtp, OTP_TTL_MS } = require("../services/otp");
const { sendOtpEmail } = require("../services/mailer");

const router = express.Router();
const fetch = global.fetch;

router.post("/login", async (req, res) => {

    try {

        const { username, password, turnstileToken } = req.body;
        const settings = await Settings.findOne();

if (settings?.security?.turnstileEnabled) {

    const response = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {

            method: "POST",

            headers: {

                "Content-Type":
                    "application/x-www-form-urlencoded"

            },

            body: new URLSearchParams({

                secret: process.env.TURNSTILE_SECRET_KEY,

                response: turnstileToken

            })

        }
    );

    const result = await response.json();

    if (!result.success) {

        return res.json({

            success: false,

            message: "Captcha verification failed"

        });

    }

}

const admin = await Admin.findOne({ username });
if (admin && admin.lockUntil && admin.lockUntil > Date.now()) {

    const remainingMinutes = Math.ceil(
        (admin.lockUntil - Date.now()) / 60000
    );

    return res.status(423).json({

        success: false,

        message: `Account locked. Try again in ${remainingMinutes} minute(s).`

    });

}

if (!admin) {

    return res.json({
        success: false,
        message: "Invalid Username or Password"
    });

}

        const match = await bcrypt.compare(

            password,

            admin.password

        );
if (!match) {

    admin.failedAttempts++;

    const lockTime = getLockDuration(admin.failedAttempts);

    if (lockTime > 0) {

        admin.lockUntil = new Date(Date.now() + lockTime);

    }

    await admin.save();

    return res.status(401).json({

        success: false,

        message: "Invalid username or password."

    });

}

        admin.failedAttempts = 0;
admin.lockUntil = null;

if (admin.twoFactorEnabled) {

    if (!admin.email) {

        return res.status(500).json({

            success: false,

            message: "2FA is enabled but no email is on file. Contact support."

        });

    }

    const otp = generateOtp();

    admin.otpCode = await hashOtp(otp);

    admin.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

    await admin.save();

    await sendOtpEmail(admin.email, otp);

    return res.json({

        success: true,

        twoFactorRequired: true,

        username: admin.username

    });

}

if (settings?.security?.forceSingleLogin) {

    admin.sessionVersion++;

    await admin.save();

}

        const token = await generateToken(admin);

        res.json({

            success: true,

            token

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

});

router.post("/login/2fa/verify", async (req, res) => {

    try {

        const { username, otp } = req.body;

        if (!username || !otp) {

            return res.status(400).json({

                success: false,

                message: "Username and code are required."

            });

        }

        const admin = await Admin.findOne({ username });

        if (!admin) {

            return res.status(404).json({

                success: false,

                message: "Admin not found."

            });

        }

        if (

            !admin.otpCode ||

            !admin.otpExpiresAt ||

            admin.otpExpiresAt < Date.now()

        ) {

            return res.status(400).json({

                success: false,

                message: "Code expired. Please login again."

            });

        }

        const matched = await compareOtp(otp, admin.otpCode);

        if (!matched) {

            return res.status(401).json({

                success: false,

                message: "Invalid verification code."

            });

        }

        admin.otpCode = "";

        admin.otpExpiresAt = null;

        const settings = await Settings.findOne();

        if (settings?.security?.forceSingleLogin) {

            admin.sessionVersion++;

        }

        await admin.save();

        const token = await generateToken(admin);

        return res.json({

            success: true,

            token

        });

    }

    catch (err) {

        console.error(err);

        return res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

});

router.post("/login/2fa/resend", async (req, res) => {

    try {

        const { username } = req.body;

        const admin = await Admin.findOne({ username });

        if (!admin || !admin.twoFactorEnabled) {

            return res.status(404).json({

                success: false,

                message: "Request failed."

            });

        }

        const otp = generateOtp();

        admin.otpCode = await hashOtp(otp);

        admin.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

        await admin.save();

        await sendOtpEmail(admin.email, otp);

        return res.json({

            success: true,

            message: "A new code has been sent."

        });

    }

    catch (err) {

        console.error(err);

        return res.status(500).json({

            success: false,

            message: "Failed to resend code."

        });

    }

});

function getLockDuration(attempts) {

    if (attempts >= 8) return 24 * 60 * 60 * 1000;

    if (attempts === 7) return 60 * 60 * 1000;

    if (attempts === 6) return 30 * 60 * 1000;

    if (attempts === 5) return 10 * 60 * 1000;

    if (attempts === 4) return 5 * 60 * 1000;

    if (attempts === 3) return 2 * 60 * 1000;

    return 0;

}

router.get("/login", async (req, res) => {

    const settings = await Settings.findOne();

    res.render("login", {

        settings

    });

});
module.exports = router;