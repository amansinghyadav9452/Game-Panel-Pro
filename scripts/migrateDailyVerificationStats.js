require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing");
    await mongoose.connect(process.env.MONGODB_URI);
    const collection = mongoose.connection.collection("dailyverificationstats");

    // The old unique dayKey index allowed only one global row per day.
    // Remove it before enabling one row per owner per day.
    const indexes = await collection.indexes();
    if (indexes.some(index => index.name === "dayKey_1")) {
        await collection.dropIndex("dayKey_1");
    }

    // Historical global totals cannot be split reliably between Admin and
    // customers. Keep them, but mark them unattributed so no panel claims them.
    await collection.updateMany(
        { ownerKey: { $exists: false } },
        { $set: { ownerKey: "unattributed", ownerType: "unattributed", customerId: null, gameId: "" } }
    );

    await collection.createIndex({ dayKey: 1, ownerKey: 1 }, { unique: true, name: "dayKey_ownerKey_unique" });
    console.log("Daily verification stats migrated. Historical global counts retained as unattributed.");
    await mongoose.disconnect();
}

main().catch(async error => {
    console.error(error);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
});
