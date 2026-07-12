const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {

    res.render("settings", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",

        pageTitle: "Settings"

    });

});

router.get("/account", (req, res) => {

    res.render("settings/account", {

        admin: {
            username: "Admin"
        },

        activePage: "settings",
        pageTitle: "Account"

    });

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

module.exports = router;