const express = require("express");
const messengerAuth = require("../middleware/messengerAuth");
const PushSubscription = require("../models/PushSubscription");

const router = express.Router();

// Client ko yahi public key chahiye subscribe karne ke liye
// (pushManager.subscribe applicationServerKey).
router.get("/api/push/vapid-public-key", (req, res) => {

    res.json({
        success: true,
        publicKey: process.env.VAPID_PUBLIC_KEY || ""
    });

});

// Browser se mila subscription object DB me save/update karo.
// messengerAuth admin, developer aur customer teeno ko allow karta
// hai (isi middleware pe dev-chat/messenger bhi chalta hai).
router.post("/api/push/subscribe", messengerAuth, async (req, res) => {

    try {

        const subscription = req.body?.subscription;

        if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {

            return res.status(400).json({
                success: false,
                message: "Invalid push subscription."
            });

        }

        await PushSubscription.findOneAndUpdate(

            { endpoint: subscription.endpoint },

            {
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth
                },
                ownerRole: req.role,
                adminId: req.role === "customer" ? null : req.admin._id,
                customerId: req.role === "customer" ? req.customer._id : null
            },

            { upsert: true, new: true, setDefaultsOnInsert: true }

        );

        res.json({ success: true });

    }

    catch (error) {

        console.error("push subscribe error:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to save push subscription."
        });

    }

});

// Logout ya permission-off hone par subscription hata do.
router.post("/api/push/unsubscribe", messengerAuth, async (req, res) => {

    try {

        const endpoint = req.body?.endpoint;

        if (endpoint) {
            await PushSubscription.deleteOne({ endpoint });
        }

        res.json({ success: true });

    }

    catch (error) {

        console.error("push unsubscribe error:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to remove push subscription."
        });

    }

});

module.exports = router;
