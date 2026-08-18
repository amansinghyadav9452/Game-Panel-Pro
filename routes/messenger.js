const express = require("express");
const messengerAuth = require("../middleware/messengerAuth");

const router = express.Router();

// Full-screen messenger page. Client-side JS checks the token itself
// (same pattern already used across the panel) and redirects to
// /login if it's missing/invalid.
router.get("/messenger", (req, res) => {

    res.render("messenger");

});

// Tells the front-end who is logged in (role + label) so the same
// page/JS works for both admin and developer without hardcoding.
router.get("/messenger/session", messengerAuth, (req, res) => {

    res.json({

        success: true,

        role: req.admin.role,

        displayName:
            req.admin.role === "developer"
                ? "Developer"
                : (req.admin.displayName || "Administrator")

    });

});

module.exports = router;
