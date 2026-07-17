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

const { isoBase64URL } = require("@simplewebauthn/server/helpers");

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

admin.currentRegistrationChallenge = options.challenge;

await admin.save();

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
    auth,
    async (req, res) => {

        try {

            const admin = req.admin;

            const verification = await verifyRegistrationResponse({

                response: req.body,

                expectedChallenge:
                    admin.currentRegistrationChallenge,

                expectedOrigin:
                    webAuthnConfig.origin,

                expectedRPID:
                    webAuthnConfig.rpID

            });

            const {
                verified,
                registrationInfo
            } = verification;

            if (!verified || !registrationInfo) {

                return res.status(400).json({

                    success: false,

                    message: "Registration verification failed."

                });

            }

            const {
                credential,
                credentialDeviceType,
                credentialBackedUp
            } = registrationInfo;

            const alreadyExists =
                admin.biometricCredentials.some(item =>
                    item.credentialID.equals(
                        Buffer.from(
                            isoBase64URL.toBuffer(credential.id)
                        )
                    )
                );

            if (alreadyExists) {

                return res.status(400).json({

                    success: false,

                    message: "This biometric is already registered."

                });

            }

            admin.biometricCredentials.push({

                credentialID:
                    Buffer.from(
                        isoBase64URL.toBuffer(credential.id)
                    ),

                publicKey:
                    Buffer.from(credential.publicKey),

                counter:
                    credential.counter,

                transports:
                    req.body.response.transports || [],

                deviceName:
                    credentialDeviceType +
                    (credentialBackedUp
                        ? " (Backed Up)"
                        : "")

            });

            admin.currentRegistrationChallenge = "";

            await admin.save();

            res.json({

                success: true,

                message:
                    "Biometric registered successfully."

            });

        }

        catch (err) {

            console.error(err);

            res.status(500).json({

                success: false,

                message:
                    "Verification failed."

            });

        }

    }
);

module.exports = router;