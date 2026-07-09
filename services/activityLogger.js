const Activity = require("../models/Activity");

async function logActivity({

    action,

    licenseKey,

    licenseType,

    admin,

    details = ""

}) {

    await Activity.create({

        action,

        licenseKey,

        licenseType,

        admin,

        details

    });

}

module.exports = logActivity;