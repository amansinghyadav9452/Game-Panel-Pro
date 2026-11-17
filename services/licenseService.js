const License = require("../models/License");
const generateKey = require("./keyGenerator");
const GameApplication = require("../models/GameApplication");
const Admin = require("../models/Admin");
const { remember, invalidate } = require("./cacheService");

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

    const results = await Promise.all([

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

    if (results.some(result => result.modifiedCount > 0)) {
        await invalidate("admin:licenses");
        await invalidate("admin:dashboard");
    }

}

async function createLicense(key, type, expiryDays, maxUses, admin, gameId = "PUBG") {

    const adminDoc = await Admin.findOne({ username: admin }).select("gameId").lean();
    const configuredGameId = String(adminDoc?.gameId || "").trim().toUpperCase();
    const normalizedGameId = configuredGameId || String(gameId || "PUBG").trim().toUpperCase();


    const application = await GameApplication.findOne({
        gameId: normalizedGameId,
        ownerType: "admin",
        status: "active"
    });

    if (!application) {
        throw new Error("Invalid Game ID");
    }

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

        createdBy: admin,

        gameId: normalizedGameId

    });

}

async function listLicenses(type) {

    // Keep expiry statuses correct, then serve the list through Redis.
    // MongoDB remains authoritative and cache entries are invalidated on writes.
    await bulkSyncLicenseStatuses({ type });

    return remember("admin:licenses", type, 3600, () => License.find({
        type
    }).sort({
        createdAt: -1
    }).lean());

}

async function searchLicense(type, key) {

    const license = await License.findOne({

        type,
        key

    });

    return await syncLicenseStatus(license);

}

async function deleteLicense(key, type = null) {

    const filter = { key };
    if (type) filter.type = type;

    return await License.findOneAndDelete(filter);

}

module.exports = {

    createLicense,

    listLicenses,

    searchLicense,

    deleteLicense,

    syncLicenseStatus,

    bulkSyncLicenseStatuses

};