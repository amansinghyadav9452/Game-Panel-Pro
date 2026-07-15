const express = require("express");

const router = express.Router();

const Admin = require("../models/Admin");

router.get("/", (req, res) => {

    res.render("settings", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",

        pageTitle: "Settings"

    });

});

router.get("/account", async (req, res) => {

    try {

        const admin = await Admin.findOne();

        if (!admin) {

            return res.status(404).json({

                success: false,

                message: "Admin not found."

            });

        }

        res.render("settings/account", {

            admin,

            activePage: "settings",

            pageTitle: "Account"

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).send("Internal Server Error");

    }

});

router.get("/security", (req, res) => {

    res.render("settings/security", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "Security"

    });

});

router.get("/license", (req, res) => {

    res.render("settings/license", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "License"

    });

});

router.get("/api", (req, res) => {

    res.render("settings/api", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "API"

    });

});

router.get("/database", (req, res) => {

    res.render("settings/database", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "Database"

    });

});

router.get("/logs", (req, res) => {

    res.render("settings/logs", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "Logs"

    });

});

router.get("/appearance", (req, res) => {

    res.render("settings/appearance", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "Appearance"

    });

});

router.get("/notifications", (req, res) => {

    res.render("settings/notifications", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "Notifications"

    });

});

router.get("/about", (req, res) => {

    res.render("settings/about", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "About"

    });

});

router.put("/account", async (req, res) => {

    try{

        const { username } = req.body;

        if(!username || username.trim() === ""){

            return res.status(400).json({

                success:false,

                message:"Username is required."

            });

        }

        const admin = await Admin.findOne();

        admin.username = username.trim();

        await admin.save();

        return res.json({

            success:true,

            message:"Account updated successfully."

        });

    }

    catch(error){

        console.error(error);

        return res.status(500).json({

            success:false,

            message:"Internal server error."

        });

    }

});

module.exports = router;