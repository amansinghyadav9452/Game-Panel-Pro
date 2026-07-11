const express = require("express");

const router = express.Router();

const Admin = require("../models/Admin");

router.get("/settings", async (req, res) => {

    const admin = await Admin.findOne();

    res.render("settings", {
        admin
    });

});

module.exports = router;