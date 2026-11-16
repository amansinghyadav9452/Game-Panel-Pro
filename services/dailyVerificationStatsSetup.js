const DailyVerificationStat = require("../models/DailyVerificationStat");

/**
 * Upgrade legacy global daily counters to owner-scoped counters at startup.
 * The old dayKey_1 unique index prevented Admin and Customer rows from
 * existing for the same date, causing the request counter upsert to fail.
 */
async function ensureDailyVerificationStatsSetup() {
    const collection = DailyVerificationStat.collection;
    const indexes = await collection.indexes();

    for (const index of indexes) {
        const keys = Object.keys(index.key || {});
        const isLegacyUniqueDayIndex = index.unique === true
            && keys.length === 1
            && keys[0] === "dayKey";
        if (isLegacyUniqueDayIndex) {
            await collection.dropIndex(index.name);
            console.log(`Removed legacy verification-stat index: ${index.name}`);
        }
    }

    // Preserve historical global rows, but do not attribute them to an owner.
    await collection.updateMany(
        { ownerKey: { $exists: false } },
        { $set: { ownerKey: "unattributed", ownerType: "unattributed", customerId: null, gameId: "" } }
    );

    await collection.createIndex(
        { dayKey: 1, ownerKey: 1 },
        { unique: true, name: "dayKey_ownerKey_unique" }
    );
}

module.exports = ensureDailyVerificationStatsSetup;
