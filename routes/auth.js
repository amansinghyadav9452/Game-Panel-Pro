const express = require("express");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");

const Admin = require("../models/Admin");
const Settings = require("../models/Settings");
const generateToken = require("../services/tokenGenerator");
const { generateOtp, hashOtp, compareOtp, OTP_TTL_MS } = require("../services/otp");
const { sendOtpEmail } = require("../services/mailer");

const router = express.Router();
const fetch = global.fetch;

// ===== RATE LIMITERS =====

// Strict limiter for login attempts (brute-force protection)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,                   // max 10 attempts per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many login attempts from this IP. Please try again later."
    }
});

// Slightly looser limiter for OTP verify (user may need a couple retries for typos)
const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many verification attempts from this IP. Please try again later."
    }
});

// Strict limiter for OTP resend (prevents email/SMS bombing)
const otpResendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many resend requests from this IP. Please try again later."
    }
});

// Strict limiter for password reset flow (prevents abuse/enumeration)
const resetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many password reset requests from this IP. Please try again later."
    }
});

router.post("/login", loginLimiter, async (req, res) => {

    try {

        const { username, password, turnstileToken, deviceId } = req.body;
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

    const remainingSeconds = Math.ceil(
        (admin.lockUntil - Date.now()) / 1000
    );

    return res.status(423).json({

        success: false,

        message: `Account locked. Try again in ${remainingMinutes} minute(s).`,

        remaining: remainingSeconds

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

    admin.loginOtpCode = await hashOtp(otp);

    admin.loginOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

    admin.loginOtpAttempts = 0;

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

        const token = await generateToken(admin, req, deviceId);

        res.json({

            success: true,

            token

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: err.message || "Server Error"

        });

    }

});

router.post("/login/2fa/verify", otpVerifyLimiter, async (req, res) => {

    try {

        const { username, otp, deviceId } = req.body;

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

            !admin.loginOtpCode ||

            !admin.loginOtpExpiresAt ||

            admin.loginOtpExpiresAt < Date.now()

        ) {

            return res.status(400).json({

                success: false,

                message: "Code expired. Please login again."

            });

        }

        if (
            admin.loginOtpAttempts >= 5
        ) {

            admin.loginOtpCode = "";
            admin.loginOtpExpiresAt = null;
            admin.loginOtpAttempts = 0;

            await admin.save();

            return res.status(429).json({

                success: false,

                message: "Too many incorrect attempts. Please login again."

            });

        }

        const matched = await compareOtp(otp, admin.loginOtpCode);

        if (!matched) {

            admin.loginOtpAttempts = (admin.loginOtpAttempts || 0) + 1;

            await admin.save();

            return res.status(401).json({

                success: false,

                message: "Invalid verification code.",

                attemptsRemaining: Math.max(0, 5 - admin.loginOtpAttempts)

            });

        }

        admin.loginOtpCode = "";

        admin.loginOtpExpiresAt = null;

        admin.loginOtpAttempts = 0;

        const settings = await Settings.findOne();

        if (settings?.security?.forceSingleLogin) {

            admin.sessionVersion++;

        }

        await admin.save();

        const token = await generateToken(admin, req, deviceId);

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

router.post("/login/2fa/resend", otpResendLimiter, async (req, res) => {

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

        admin.loginOtpCode = await hashOtp(otp);

        admin.loginOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

        admin.loginOtpAttempts = 0;

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
router.post("/login/reset-password/send-otp", resetLimiter, async (req, res) => {

    try {

        const { username } = req.body;

        if (!username) {

            return res.status(400).json({

                success: false,

                message: "Username is required."

            });

        }

        const admin = await Admin.findOne({ username });

        if (!admin) {

            return res.status(404).json({

                success: false,

                message: "Admin not found."

            });

        }

        if (!admin.email) {

            return res.status(400).json({

                success: false,

                message: "No recovery email on file for this account."

            });

        }

        const otp = generateOtp();

        admin.resetOtpCode = await hashOtp(otp);

        admin.resetOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

        await admin.save();

        await sendOtpEmail(admin.email, otp);

        return res.json({

            success: true,

            message: "Verification code sent to " + admin.email + "."

        });

    }

    catch (err) {

        console.error(err);

        return res.status(500).json({

            success: false,

            message: err.message || "Failed to send code."

        });

    }

});

router.post("/login/reset-password/verify-otp", resetLimiter, async (req, res) => {

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

            !admin.resetOtpCode ||

            !admin.resetOtpExpiresAt ||

            admin.resetOtpExpiresAt < Date.now()

        ) {

            return res.status(400).json({

                success: false,

                message: "Code expired. Please request a new one."

            });

        }

        if (

            admin.resetOtpAttempts >= 5

        ) {

            admin.resetOtpCode = "";

            admin.resetOtpExpiresAt = null;

            admin.resetOtpAttempts = 0;

            await admin.save();

            return res.status(429).json({

                success: false,

                message: "Too many incorrect attempts. Please request a new code."

            });

        }

        const matched = await compareOtp(otp, admin.resetOtpCode);

        if (!matched) {

            admin.resetOtpAttempts = (admin.resetOtpAttempts || 0) + 1;

            await admin.save();

            return res.status(401).json({

                success: false,

                message: "Invalid verification code.",

                attemptsRemaining: Math.max(0, 5 - admin.resetOtpAttempts)

            });

        }

        admin.resetOtpAttempts = 0;

        await admin.save();

        return res.json({

            success: true,

            message: "Code verified."

        });

    }

    catch (err) {

        console.error(err);

        return res.status(500).json({

            success: false,

            message: err.message || "Verification failed."

        });

    }

});

router.post("/login/reset-password/reset", resetLimiter, async (req, res) => {

    try {

        const {
            username,
            otp,
            newPassword,
            confirmPassword
        } = req.body;

        if (!username || !otp || !newPassword || !confirmPassword) {

            return res.status(400).json({

                success: false,

                message: "All fields are required."

            });

        }

        if (newPassword !== confirmPassword) {

            return res.status(400).json({

                success: false,

                message: "Passwords do not match."

            });

        }

        if (newPassword.length < 6) {

            return res.status(400).json({

                success: false,

                message: "Password must be at least 6 characters."

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

            !admin.resetOtpCode ||

            !admin.resetOtpExpiresAt ||

            admin.resetOtpExpiresAt < Date.now()

        ) {

            return res.status(400).json({

                success: false,

                message: "Code expired. Please request a new one."

            });

        }

        if (

            admin.resetOtpAttempts >= 5

        ) {

            admin.resetOtpCode = "";

            admin.resetOtpExpiresAt = null;

            admin.resetOtpAttempts = 0;

            await admin.save();

            return res.status(429).json({

                success: false,

                message: "Too many incorrect attempts. Please request a new code."

            });

        }

        const matched = await compareOtp(otp, admin.resetOtpCode);

        if (!matched) {

            admin.resetOtpAttempts = (admin.resetOtpAttempts || 0) + 1;

            await admin.save();

            return res.status(401).json({

                success: false,

                message: "Invalid verification code.",

                attemptsRemaining: Math.max(0, 5 - admin.resetOtpAttempts)

            });

        }

        admin.password = await bcrypt.hash(newPassword, 10);

        admin.resetOtpCode = "";

        admin.resetOtpExpiresAt = null;

        admin.resetOtpAttempts = 0;

        admin.sessionVersion++;

        await admin.save();

        return res.json({

            success: true,

            message: "Password reset successfully. Please login."

        });

    }

    catch (err) {

        console.error(err);

        return res.status(500).json({

            success: false,

            message: err.message || "Failed to reset password."

        });

    }

});

module.exports = router;