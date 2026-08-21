// Customer-facing AI Copilot tools. Deliberately a SEPARATE, much
// smaller registry from services/ai/toolRegistry.js (the admin one) -
// every tool here is bound to context.customerId (set server-side
// from the customer's own auth token, never from anything the model
// or the customer can supply) so there is no way for this registry to
// read another customer's keys/logs, the admin's License collection,
// or any admin account/credential data.

const {
    getCustomerKeyModel,
    getCustomerCrudLogModel,
    getCustomerActivityLogModel
} = require("../customerModels");

const generateKey = require("../keyGenerator");

function clampString(value, maxLength = 100) {

    if (typeof value !== "string") return "";

    return value.trim().slice(0, maxLength);

}

function clampNumber(value, min, max, fallback) {

    const n = Number(value);

    if (!Number.isFinite(n)) return fallback;

    return Math.min(max, Math.max(min, n));

}

const tools = {

    getMyStats: {

        description:
            "Get this customer's own key stats: total/active/expired/banned key counts, split by public/premium.",

        destructive: false,

        parameters: {},

        async execute(args, context) {

            const KeyModel = getCustomerKeyModel(context.customerId);

            const [byStatus, byType] = await Promise.all([

                KeyModel.aggregate([
                    { $group: { _id: "$status", count: { $sum: 1 } } }
                ]),

                KeyModel.aggregate([
                    { $group: { _id: "$type", count: { $sum: 1 } } }
                ])

            ]);

            let activeKeys = 0, expiredKeys = 0, bannedKeys = 0;
            let publicKeys = 0, premiumKeys = 0;

            for (const row of byStatus) {
                if (row._id === "banned") bannedKeys = row.count;
                else if (row._id === "expired") expiredKeys = row.count;
                else if (row._id === "active") activeKeys = row.count;
            }

            for (const row of byType) {
                if (row._id === "premium") premiumKeys = row.count;
                else if (row._id === "public") publicKeys = row.count;
            }

            return {

                totalKeys: activeKeys + expiredKeys + bannedKeys,
                activeKeys,
                expiredKeys,
                bannedKeys,
                publicKeys,
                premiumKeys

            };

        }

    },

    searchMyKeys: {

        description:
            "Search this customer's own key list by exact/partial key, type (public/premium), or status (active/expired/banned). Returns up to 15 matches.",

        destructive: false,

        parameters: {
            key: "string, optional (exact or partial key)",
            type: "'public' or 'premium', optional",
            status: "'active', 'expired', or 'banned', optional"
        },

        async execute(args, context) {

            const KeyModel = getCustomerKeyModel(context.customerId);

            const query = {};

            if (args.key) {

                const safeKey = clampString(args.key, 64).replace(/[^a-zA-Z0-9-_]/g, "");

                if (safeKey) query.key = { $regex: safeKey, $options: "i" };

            }

            if (args.type === "public" || args.type === "premium") {
                query.type = args.type;
            }

            if (["active", "expired", "banned"].includes(args.status)) {
                query.status = args.status;
            }

            const keys = await KeyModel.find(query)
                .sort({ createdAt: -1 })
                .limit(15)
                .lean();

            return keys.map(k => ({

                key: k.key,
                type: k.type,
                status: k.status,
                expiry: k.expiry,
                maxUses: k.maxUses,
                usedCount: k.usedCount,
                devices: (k.devices || []).length,
                createdAt: k.createdAt

            }));

        }

    },

    searchMyLogs: {

        description:
            "Search recent verification/connection attempts against this customer's own keys, by key, device serial, or status (success/failed). Returns up to 15 most recent matches.",

        destructive: false,

        parameters: {
            licenseKey: "string, optional",
            serial: "string, optional",
            status: "'success' or 'failed', optional"
        },

        async execute(args, context) {

            const ActivityLog = getCustomerActivityLogModel(context.customerId);

            const query = {};

            if (args.licenseKey) query.licenseKey = clampString(args.licenseKey, 64);
            if (args.serial) query.serial = clampString(args.serial, 128);

            if (args.status === "success" || args.status === "failed") {
                query.status = args.status;
            }

            const logs = await ActivityLog.find(query)
                .sort({ createdAt: -1 })
                .limit(15)
                .lean();

            return logs.map(l => ({

                licenseKey: l.licenseKey,
                licenseType: l.licenseType,
                deviceModel: l.deviceModel,
                deviceBrand: l.deviceBrand,
                serial: l.serial,
                status: l.status,
                reason: l.reason,
                createdAt: l.createdAt

            }));

        }

    },

    createKey: {

        description:
            "Create a new key (public or premium) for this customer's own inventory. Requires user confirmation before running.",

        destructive: true,

        parameters: {
            type: "'public' or 'premium', required",
            expiryDays: "number, optional (default 30)",
            maxUses: "number, optional (default 1)"
        },

        async execute(args, context) {

            const type = args.type === "premium" ? "premium" : "public";

            const expiryDays = clampNumber(args.expiryDays, 1, 3650, 30);
            const maxUses = clampNumber(args.maxUses, 1, 100, 1);

            const KeyModel = getCustomerKeyModel(context.customerId);

            let key = generateKey(type);

            let attempts = 0;

            while (attempts < 10 && (await KeyModel.findOne({ key }))) {
                key = generateKey(type);
                attempts++;
            }

            const expiry = new Date();
            expiry.setDate(expiry.getDate() + expiryDays);

            const doc = await KeyModel.create({
                key,
                type,
                expiry,
                maxUses
            });

            const CrudLog = getCustomerCrudLogModel(context.customerId);

            await CrudLog.create({
                action: "created",
                key,
                type,
                details: `Created via AI Copilot with ${expiryDays}d expiry`
            });

            return {

                key: doc.key,
                type: doc.type,
                expiry: doc.expiry,
                maxUses: doc.maxUses

            };

        }

    },

    banKey: {

        description:
            "Ban one of this customer's own keys by its exact key value, so it stops working. Requires user confirmation before running.",

        destructive: true,

        parameters: {
            key: "string, required",
            reason: "string, optional"
        },

        async execute(args, context) {

            const key = clampString(args.key, 64);

            if (!key) throw new Error("A key is required.");

            const KeyModel = getCustomerKeyModel(context.customerId);

            const doc = await KeyModel.findOne({ key });

            if (!doc) throw new Error("Key not found in your inventory.");

            doc.status = "banned";
            doc.banReason = clampString(args.reason || "Banned via AI Copilot", 200);

            await doc.save();

            const CrudLog = getCustomerCrudLogModel(context.customerId);

            await CrudLog.create({ action: "banned", key: doc.key, type: doc.type });

            return { key: doc.key, status: doc.status };

        }

    },

    unbanKey: {

        description:
            "Unban one of this customer's own keys by its exact key value. Requires user confirmation before running.",

        destructive: true,

        parameters: {
            key: "string, required"
        },

        async execute(args, context) {

            const key = clampString(args.key, 64);

            if (!key) throw new Error("A key is required.");

            const KeyModel = getCustomerKeyModel(context.customerId);

            const doc = await KeyModel.findOne({ key });

            if (!doc) throw new Error("Key not found in your inventory.");

            doc.status = doc.expiry > new Date() ? "active" : "expired";
            doc.banReason = "";

            await doc.save();

            const CrudLog = getCustomerCrudLogModel(context.customerId);

            await CrudLog.create({ action: "unbanned", key: doc.key, type: doc.type });

            return { key: doc.key, status: doc.status };

        }

    },

    extendKey: {

        description:
            "Extend the expiry of one of this customer's own keys by a number of days. Requires user confirmation before running.",

        destructive: true,

        parameters: {
            key: "string, required",
            days: "number, required"
        },

        async execute(args, context) {

            const key = clampString(args.key, 64);
            const days = clampNumber(args.days, 1, 3650, null);

            if (!key) throw new Error("A key is required.");
            if (!days) throw new Error("A valid number of days is required.");

            const KeyModel = getCustomerKeyModel(context.customerId);

            const doc = await KeyModel.findOne({ key });

            if (!doc) throw new Error("Key not found in your inventory.");

            const base = doc.expiry > new Date() ? doc.expiry : new Date();

            base.setDate(base.getDate() + days);

            doc.expiry = base;

            if (doc.status === "expired") doc.status = "active";

            await doc.save();

            const CrudLog = getCustomerCrudLogModel(context.customerId);

            await CrudLog.create({ action: "extended", key: doc.key, type: doc.type, details: `+${days}d` });

            return { key: doc.key, expiry: doc.expiry };

        }

    },

    resetKeyDevice: {

        description:
            "Reset the device binding on one of this customer's own keys, freeing it to be used on a new device. Requires user confirmation before running.",

        destructive: true,

        parameters: {
            key: "string, required"
        },

        async execute(args, context) {

            const key = clampString(args.key, 64);

            if (!key) throw new Error("A key is required.");

            const KeyModel = getCustomerKeyModel(context.customerId);

            const doc = await KeyModel.findOne({ key });

            if (!doc) throw new Error("Key not found in your inventory.");

            doc.devices = [];
            doc.usedCount = 0;
            doc.lastDevice = null;

            await doc.save();

            const CrudLog = getCustomerCrudLogModel(context.customerId);

            await CrudLog.create({ action: "reset-device", key: doc.key, type: doc.type });

            return { key: doc.key };

        }

    }

};

function listToolDefinitions() {

    return Object.entries(tools).map(([name, tool]) => ({

        name,
        description: tool.description,
        destructive: tool.destructive,
        parameters: tool.parameters

    }));

}

async function executeTool(name, args, context) {

    const tool = tools[name];

    if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
    }

    return tool.execute(args || {}, context);

}

function isDestructive(name) {

    return !!(tools[name] && tools[name].destructive);

}

function toolExists(name) {

    return !!tools[name];

}

module.exports = {

    listToolDefinitions,
    executeTool,
    isDestructive,
    toolExists

};
