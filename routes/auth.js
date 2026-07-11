const express = require("express");
const bcrypt = require("bcrypt");

const Admin = require("../models/Admin");
const generateToken = require("../services/tokenGenerator");

const router = express.Router();
const fetch = global.fetch

router.post("/login", async (req, res) => {

    try {

        const { username, password, turnstileToken } = req.body;

        const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {

        method: "POST",

        headers: {
            "Content-Type":
            "application/x-www-form-urlencoded"
        },

        body: new URLSearchParams({

            secret:
            process.env.TURNSTILE_SECRET_KEY,

            response:
            turnstileToken

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

const admin = await Admin.findOne({ username });

if (!admin) {

    return res.json({
        success: false,
        message: "Invalid Username or Password"
    });

}

if (admin.lockUntil && admin.lockUntil > Date.now()) {

    const remaining = Math.ceil(
        (admin.lockUntil - Date.now()) / 1000
    );

    return res.json({
        success: false,
        message: "Too many failed login attempts.",
        remaining
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

    return res.json({

        success: false,

        message: "Invalid Username or Password"

    });

}

        admin.failedAttempts = 0;
admin.lockUntil = null;

await admin.save();

        const token = generateToken(admin);

        res.json({

            success: true,

            token

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

});

function getLockDuration(attempts) {

    if (attempts >= 8) return 24 * 60 * 60 * 1000; // 24 Hours

    if (attempts === 7) return 60 * 60 * 1000; // 1 Hour

    if (attempts === 6) return 30 * 60 * 1000; // 30 Minutes

    if (attempts === 5) return 10 * 60 * 1000; // 10 Minutes

    if (attempts === 4) return 5 * 60 * 1000; // 5 Minutes

    if (attempts === 3) return 2 * 60 * 1000; // 2 Minutes

    return 0;

}
router.get("/login", (req, res) => {

    res.render("login");

});
module.exports = router;