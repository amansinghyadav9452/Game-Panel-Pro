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

// Same effect as calling syncLicenseStatus() on every matching license, but
// as two bulk updateMany() calls instead of N sequential find + save round
// trips. `scope` can narrow it to a type (e.g. { type: "premium" }).
async function bulkSyncLicenseStatuses(scope = {}) {

    const now = new Date();

    await Promise.all([

        License.updateMany(
            {
                ...scope,
                status: "active",
                expiry: { $lte: now }
            },
            { $set: { status: "expired" } }
        ),

        License.updateMany(
            {
                ...scope,
                status: "expired",
                expiry: { $gt: now }
            },
            { $set: { status: "active" } }
        )

    ]);

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

    // One bulk update instead of a save() per license.
    await bulkSyncLicenseStatuses({ type });

    return await License.find({
        type
    }).sort({
        createdAt: -1
    });

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

    syncLicenseStatus,

    bulkSyncLicenseStatuses

};