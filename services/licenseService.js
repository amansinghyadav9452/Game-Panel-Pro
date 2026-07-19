const License = require("../models/License");
const generateKey = require("./keyGenerator");

async function syncLicenseStatus(license) {

    if (!license) {

        return null;

    }

    if (license.status === "banned") {

        return license;

    }

    const shouldExpire = license.expiry <= new Date();

    if (shouldExpire && license.status !== "expired") {

        license.status = "expired";
        await license.save();

    } else if (!shouldExpire && license.status === "expired") {

        license.status = "active";
        await license.save();

    }

    return license;

}

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

    const licenses = await License.find({
        type
    }).sort({
        createdAt: -1
    });

    for (const license of licenses) {

        await syncLicenseStatus(license);

    }

    return licenses;

}

async function searchLicense(type, key) {

    const license = await License.findOne({

        type,
        key

    });

    return await syncLicenseStatus(license);

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

    deleteLicense,

    syncLicenseStatus

};