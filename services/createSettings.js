const Settings = require("../models/Settings");

async function createSettings() {

    try {

        const settings = await Settings.findOne();

        if (settings) {

            console.log("✅ Settings already exist");

            return;

        }

        await Settings.create({});

        console.log("✅ Default settings created");

    } catch (err) {

        console.error(
            "Settings Initialization Failed:",
            err
        );

    }

}

module.exports = createSettings;