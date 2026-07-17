const express = require("express");

const router = express.Router();

const generateToken = require("../services/tokenGenerator");

const { TextEncoder } = require("util");

const auth = require("../middleware/auth");


const {
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyRegistrationResponse,
    verifyAuthenticationResponse
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

        allowCredentials:
            admin.biometricCredentials.map(credential => ({

                id: isoBase64URL.fromBuffer(credential.credentialID),

                type: "public-key",

                transports: credential.transports

            })),

        userVerification: "preferred"

    });

admin.currentAuthenticationChallenge = options.challenge;

await admin.save();

console.log("LOGIN OPTIONS");
console.log(options);

console.log(
    "Saved Login Challenge:",
    admin.currentAuthenticationChallenge
);

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

console.log("Saved Challenge:", admin.currentRegistrationChallenge);

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

            console.log("Challenge From DB:", admin.currentRegistrationChallenge);

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

router.post(
    "/login/verify",
    async (req, res) => {

        try {

            const { username, authenticationResponse } = req.body;

const admin = await Admin.findOne({ username });

if (!admin) {

    return res.status(404).json({
        success: false,
        message: "Admin not found."
    });

}

console.log(
    "Challenge From DB:",
    admin.currentAuthenticationChallenge
);

            const passkey = admin.biometricCredentials.find(item =>
                isoBase64URL.fromBuffer(item.credentialID) === authenticationResponse.id
            );

            if (!passkey) {

                return res.status(404).json({

                    success: false,

                    message: "Passkey not found."

                });

            }

            const verification =
                await verifyAuthenticationResponse({

                    response: authenticationResponse,

                    expectedChallenge:
                        admin.currentAuthenticationChallenge,

                    expectedOrigin:
                        webAuthnConfig.origin,

                    expectedRPID:
                        webAuthnConfig.rpID,

                    credential: {

                        id: authenticationResponse.id,

                        publicKey:
                            new Uint8Array(passkey.publicKey),

                        counter:
                            passkey.counter,

                        transports:
                            passkey.transports

                    }

                });

            const { verified, authenticationInfo } = verification;

            if (!verified) {

                return res.status(400).json({

                    success: false,

                    message: "Authentication failed."

                });

            }

            passkey.counter = authenticationInfo.newCounter;

            admin.currentAuthenticationChallenge = "";

            await admin.save();

            const token = await generateToken(admin);

            res.json({

                success: true,

                token

            });

        }

        catch (err) {

            console.error(err);

            res.status(500).json({

                success: false,

                message: "Authentication failed."

            });

        }

    }
);

module.exports = router;