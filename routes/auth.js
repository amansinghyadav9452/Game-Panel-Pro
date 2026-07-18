const express = require("express");
const bcrypt = require("bcrypt");

const Admin = require("../models/Admin");
const Settings = require("../models/Settings");
const generateToken = require("../services/tokenGenerator");

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