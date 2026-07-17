const express = require("express");

const router = express.Router();

const { TextEncoder } = require("util");

const auth = require("../middleware/auth");

const {
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyRegistrationResponse
} = require("@simplewebauthn/server");

const Admin = require("../models/Admin");

const webAuthnConfig = require("../config/webauthn");

router.get(
    "/status",
    (req, res) => {

        res.json({

            success: true,

            message: "WebAuthn route is working."

        });

    }
);

router.post(
    "/login/options",
    async (req, res) => {

        try {

            const { username } = req.body;

            const admin = await Admin.findOne({ username });

            if (!admin) {

                return res.status(404).json({

                    success: false,

                    message: "Admin not found."

                });

            }

            const options =
                await generateAuthenticationOptions({

                    rpID: webAuthnConfig.rpID,

                    allowCredentials: admin.webauthn?.credentialID
                        ? [{
                            id: admin.webauthn.credentialID,
                            type: "public-key",
                            transports: admin.webauthn.transports
                        }]
                        : [],

                    userVerification: "preferred"

                });
                console.log(options);
            res.json(options);

        }

        catch (err) {

            console.error(err);

            res.status(500).json({

                success: false,

                message: "Failed to generate authentication options."

            });

        }

    }
);

router.post(
    "/register/options",
    auth,
    async (req, res) => {

        try {

            const admin = req.admin;

            if (!admin) {

                return res.status(404).json({

                    success: false,

                    message: "Admin not found."

                });

            }

            const options =
                await generateRegistrationOptions({

                    rpName: webAuthnConfig.rpName,

                    rpID: webAuthnConfig.rpID,

                    userName: admin.username,

                    userID: new TextEncoder().encode(admin._id.toString()),

                    userDisplayName: admin.username,

                    authenticatorSelection: {

                        residentKey: "preferred",

                        userVerification: "preferred"

                    }

                });

console.log("REGISTER OPTIONS");
console.log(options);

            res.json(options);

        }

        catch (err) {

            console.error(err);

            res.status(500).json({

                success: false,

                message: "Failed to generate registration options."

            });

        }

    }
);

router.post(
    "/register/verify",
    async (req, res) => {

        try {

            res.json({

                success: true,

                message: "Verify route reached.",

                body: req.body

            });

        }

        catch (err) {

            console.error(err);

            res.status(500).json({

                success: false,

                message: "Verification failed."

            });

        }

    }
);

module.exports = router;