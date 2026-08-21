const GameApplication = require("../models/GameApplication");
const Customer = require("../models/Customer");
const License = require("../models/License");
const { generateUniqueGameId } = require("./gameId");

async function ensureGameApplicationSetup() {
    // Preserve the existing protocol value used by older admin CPP builds.
    await GameApplication.updateOne(
        { gameId: "PUBG" },
        {
            $setOnInsert: {
                gameId: "PUBG",
                name: "Legacy / Default Application",
                ownerType: "admin",
                customerId: null,
                status: "active"
            }
        },
        { upsert: true }
    );

    // Existing admin licenses remain usable by the legacy `game=PUBG` client.
    await License.updateMany(
        { gameId: { $exists: false } },
        { $set: { gameId: "PUBG" } }
    );

    // Backfill old customers created before Game IDs existed. Each customer
    // gets one immutable application identity, and that identity is what the
    // customer's isolated key collection represents.
    const customers = await Customer.find({
        $or: [
            { gameId: { $exists: false } },
            { gameId: null },
            { gameId: "" }
        ]
    }).select("_id");

    for (const customer of customers) {
        const gameId = await generateUniqueGameId();

        await Customer.updateOne(
            { _id: customer._id, $or: [{ gameId: { $exists: false } }, { gameId: null }, { gameId: "" }] },
            { $set: { gameId } }
        );

        await GameApplication.updateOne(
            { customerId: customer._id },
            {
                $setOnInsert: {
                    gameId,
                    name: `Customer ${customer._id.toString().slice(-6)}`,
                    ownerType: "customer",
                    customerId: customer._id,
                    status: "active"
                }
            },
            { upsert: true }
        );
    }

    // Ensure every customer that already has an ID also has the corresponding
    // application record.
    const activeCustomers = await Customer.find({ gameId: { $exists: true, $nin: [null, ""] } })
        .select("_id username gameId")
        .lean();

    for (const customer of activeCustomers) {
        await GameApplication.updateOne(
            { customerId: customer._id },
            {
                $setOnInsert: {
                    gameId: customer.gameId,
                    name: customer.username,
                    ownerType: "customer",
                    customerId: customer._id,
                    status: "active"
                }
            },
            { upsert: true }
        );
    }
}

module.exports = ensureGameApplicationSetup;
