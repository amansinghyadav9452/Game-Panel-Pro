const express = require("express");
const auth = require("../middleware/auth");
const Customer = require("../models/Customer");
const GameApplication = require("../models/GameApplication");
const License = require("../models/License");
const { generateUniqueGameId } = require("../services/gameId");

const router = express.Router();

// Admin/developer application registry.
router.get("/", auth, async (req, res) => {
    try {
        const apps = await GameApplication.find({ ownerType: "admin" })
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, applications: apps });
    } catch (err) {
        console.error("Game application list error:", err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

router.post("/", auth, async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        if (!name || name.length > 80) {
            return res.status(400).json({ success: false, message: "Valid application name is required." });
        }

        const gameId = await generateUniqueGameId();
        const application = await GameApplication.create({
            gameId,
            name,
            ownerType: "admin",
            status: "active"
        });

        res.status(201).json({ success: true, application });
    } catch (err) {
        console.error("Game application create error:", err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

router.put("/:gameId/status", auth, async (req, res) => {
    try {
        const status = req.body.status;
        if (!["active", "disabled"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status." });
        }

        const application = await GameApplication.findOneAndUpdate(
            { gameId: String(req.params.gameId).trim().toUpperCase(), ownerType: "admin" },
            { $set: { status } },
            { returnDocument: "after" }
        );

        if (!application) {
            return res.status(404).json({ success: false, message: "Application not found." });
        }

        res.json({ success: true, application });
    } catch (err) {
        console.error("Game application status error:", err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// Customer Game IDs are read-only identities. Admin can inspect them here.
router.get("/customers", auth, async (req, res) => {
    try {
        const applications = await GameApplication.find({ ownerType: "customer" })
            .populate("customerId", "username status expiryAt")
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, applications });
    } catch (err) {
        console.error("Customer application list error:", err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

module.exports = router;
