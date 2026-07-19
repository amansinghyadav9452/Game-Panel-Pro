const License = require("../models/License");

async function deleteExpiredLicenses() {

    const cutoff = new Date();

    cutoff.setDate(cutoff.getDate() - 3);

    await License.deleteMany({
        status: "expired",
        expiry: {
            $lte: cutoff
        }
    });

}

module.exports = deleteExpiredLicenses;