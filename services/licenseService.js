const License = require("../models/License");
const generateKey = require("./keyGenerator");

async function createLicense(key, type, expiryDays, maxUses, admin) {

    const exists = await License.findOne({ key });

if (exists) {

    throw new Error("License Key Already Exists");

}

    const expiry = new Date();

    expiry.setDate(
        expiry.getDate() + Number(expiryDays)
    );

    return await License.create({

        key,

        type,

        expiry,

        maxUses,

        createdBy: admin

    });

}

async function listLicenses(type) {

    return await License.find({

        type

    }).sort({

        createdAt: -1

    });

}

async function searchLicense(type, key) {

    return await License.findOne({

        type,

        key

    });

}

async function deleteLicense(key) {

    return await License.findOneAndDelete({

        key

    });

}

module.exports = {

    createLicense,

    listLicenses,

    searchLicense,

    deleteLicense

};