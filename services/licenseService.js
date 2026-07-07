const License = require("../models/License");
const generateKey = require("./keyGenerator");

async function createLicense(type, expiryDays, maxUses, admin) {

    const key = generateKey(type);

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

async function deleteLicense(id) {

    return await License.findByIdAndDelete(id);

}

module.exports = {

    createLicense,

    listLicenses,

    searchLicense,

    deleteLicense

};