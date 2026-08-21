const express = require("express");
const crypto = require("crypto");

const auth = require("../middleware/auth");
const ReferralCode = require("../models/ReferralCode");
const Customer = require("../models/Customer");

const router = express.Router();

router.get("/referrals", (req, res) => {

    res.render("referrals", {
        activePage: "referrals",
        pageTitle: "Referrals",
        admin: req.admin
    });

});


const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode() {

    let code = "";

    for (let i = 0; i < 10; i++) {
        code += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
    }

    return `REF-${code}`;

}

// Create a new referral code. Admin picks how many days it (and the
// customer's access once redeemed) stays valid for.
router.post("/referral", auth, async (req, res) => {

    try {

        const { expiryDays, note } = req.body;

        const days = Number(expiryDays);

        if (!Number.isFinite(days) || days <= 0) {

            return res.status(400).json({
                success: false,
                message: "Valid expiryDays is required."
            });

        }

        const expiryAt = new Date();
        expiryAt.setDate(expiryAt.getDate() + days);

        let code = randomCode();

        // Extremely unlikely collision, but guard anyway.
        while (await ReferralCode.findOne({ code })) {
            code = randomCode();
        }

        const referral = await ReferralCode.create({
            code,
            expiryAt,
            note: note || "",
            createdBy: req.admin.username
        });

        res.json({ success: true, referral });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

router.get("/referral", auth, async (req, res) => {

    try {

        const referrals = await ReferralCode.find({})
            .sort({ createdAt: -1 })
            .populate("usedBy", "username expiryAt status")
            .lean();

        res.json({ success: true, referrals });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

// Revoke an unused code so it can never be redeemed.
router.put("/referral/:id/revoke", auth, async (req, res) => {

    try {

        const referral = await ReferralCode.findById(req.params.id);

        if (!referral) {

            return res.status(404).json({ success: false, message: "Referral code not found." });

        }

        if (referral.status === "used") {

            return res.status(400).json({
                success: false,
                message: "Already used - disable the customer account instead."
            });

        }

        referral.status = "revoked";

        await referral.save();

        res.json({ success: true, referral });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

router.delete("/referral/:id", auth, async (req, res) => {

    try {

        const referral = await ReferralCode.findById(req.params.id);

        if (!referral) {

            return res.status(404).json({ success: false, message: "Referral code not found." });

        }

        // Used codes may be deleted as historical referral records. This
        // does NOT delete or disable the customer referenced by usedBy.
        // The customer account owns its own access lifecycle.
        await referral.deleteOne();

        res.json({ success: true });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

// ===== Customer management (admin side) =====

router.get("/customers", auth, async (req, res) => {

    try {

        const customers = await Customer.find({})
            .select("-password")
            .sort({ createdAt: -1 })
            .lean();

        res.json({ success: true, customers });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

// Manual disable/enable - independent of referral expiry. Data is
// never deleted here, only access is toggled.
router.put("/customers/:id/status", auth, async (req, res) => {

    try {

        const { status } = req.body;

        if (!["active", "disabled"].includes(status)) {

            return res.status(400).json({ success: false, message: "Invalid status." });

        }

        const customer = await Customer.findById(req.params.id);

        if (!customer) {

            return res.status(404).json({ success: false, message: "Customer not found." });

        }

        customer.status = status;

        // Force re-login everywhere if being disabled.
        if (status === "disabled") {
            customer.sessionVersion += 1;
        }

        await customer.save();

        res.json({ success: true, customer: { ...customer.toObject(), password: undefined } });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

// Extend a customer's access without issuing a new referral code.
router.put("/customers/:id/extend", auth, async (req, res) => {

    try {

        const { expiryDays } = req.body;

        const days = Number(expiryDays);

        if (!Number.isFinite(days) || days <= 0) {

            return res.status(400).json({ success: false, message: "Valid expiryDays is required." });

        }

        const customer = await Customer.findById(req.params.id);

        if (!customer) {

            return res.status(404).json({ success: false, message: "Customer not found." });

        }

        const base = customer.expiryAt > new Date() ? customer.expiryAt : new Date();

        base.setDate(base.getDate() + days);

        customer.expiryAt = base;

        await customer.save();

        res.json({ success: true, customer: { ...customer.toObject(), password: undefined } });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

// Permanent delete - explicit admin action only, per spec data stays
// until this is called manually.
router.delete("/customers/:id", auth, async (req, res) => {

    try {

        const customer = await Customer.findByIdAndDelete(req.params.id);

        if (!customer) {

            return res.status(404).json({ success: false, message: "Customer not found." });

        }

        res.json({ success: true });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({ success: false, message: "Server Error" });

    }

});

module.exports = router;
