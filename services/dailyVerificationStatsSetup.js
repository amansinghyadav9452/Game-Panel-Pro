const DailyVerificationStat = require("../models/DailyVerificationStat");

/**
 * Idempotently migrate daily verification counters to owner-scoped indexes.
 * MongoDB identifies indexes by key pattern and options; an existing
 * equivalent index may have a different generated/custom name. Never try to
 * create a second name for the same key pattern.
 */
async function ensureDailyVerificationStatsSetup() {
    const collection = DailyVerificationStat.collection;
    let indexes = await collection.indexes();

    // Remove only the old global unique dayKey index. It prevents multiple
    // owners from recording counts on the same calendar day.
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

    // Historical global rows remain available but are not attributed to
    // Admin or any Customer because their original owner cannot be inferred.
    await collection.updateMany(
        { ownerKey: { $exists: false } },
        { $set: { ownerKey: "unattributed", ownerType: "unattributed", customerId: null, gameId: "" } }
    );

    indexes = await collection.indexes();
    const ownerScoped = indexes.find(index => {
        const entries = Object.entries(index.key || {});
        return entries.length === 2
            && entries[0][0] === "dayKey" && entries[0][1] === 1
            && entries[1][0] === "ownerKey" && entries[1][1] === 1;
    });

    if (ownerScoped?.unique === true) {
        console.log(`Owner-scoped verification-stat index ready: ${ownerScoped.name}`);
        return;
    }

    // A non-unique index with the same key pattern cannot enforce the upsert
    // uniqueness guarantee. Replace it, then let MongoDB choose its canonical
    // generated name (dayKey_1_ownerKey_1).
    if (ownerScoped) {
        await collection.dropIndex(ownerScoped.name);
    }

    try {
        await collection.createIndex(
            { dayKey: 1, ownerKey: 1 },
            { unique: true }
        );
    } catch (error) {
        // Mongoose autoIndex may create the exact schema index concurrently.
        // Treat that race as success only after verifying the actual index.
        if (error?.code !== 85 && error?.code !== 86) throw error;
        const latest = await collection.indexes();
        const equivalentUnique = latest.some(index => {
            const entries = Object.entries(index.key || {});
            return index.unique === true
                && entries.length === 2
                && entries[0][0] === "dayKey" && entries[0][1] === 1
                && entries[1][0] === "ownerKey" && entries[1][1] === 1;
        });
        if (!equivalentUnique) throw error;
    }

    console.log("Owner-scoped verification-stat index ready.");
}

module.exports = ensureDailyVerificationStatsSetup;
