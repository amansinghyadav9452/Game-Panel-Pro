const express = require("express");

const router = express.Router();

const {
    generateAuthenticationOptions
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

module.exports = router;