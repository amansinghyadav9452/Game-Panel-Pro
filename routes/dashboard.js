const express = require("express");

const auth = require("../middleware/auth");

const router = express.Router();

router.get("/dashboard", auth, (req, res) => {

    res.json({

        success: true,

        admin: req.admin,

        message: "Dashboard Access Granted"

    });

});

module.exports = router;