const License = require("../../models/License");
const UserLog = require("../../models/UserLog");
const BannedDevice = require("../../models/BannedDevice");
const Settings = require("../../models/Settings");
const generateKey = require("../keyGenerator");
const { createLicense } = require("../licenseService");

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

    getDashboardStats: {

        description:
            "Get overall panel stats: total/active/expired/banned license counts, total devices, total banned devices.",

        destructive: false,

        parameters: {},

        async execute() {

            // Aggregate in the DB instead of pulling every license
            // document into Node just to count them.
            const [byStatus, byType, bannedDevices] = await Promise.all([

                License.aggregate([
                    { $group: { _id: "$status", count: { $sum: 1 } } }
                ]),

                License.aggregate([
                    { $group: { _id: "$type", count: { $sum: 1 } } }
                ]),

                BannedDevice.countDocuments()

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
                premiumKeys,
                bannedDevices

            };

        }

    },

    searchLogs: {

        description:
            "Search recent connection logs by license key, device serial, or status (success/failed). Returns up to 15 most recent matches.",

        destructive: false,

        parameters: {
            licenseKey: "string, optional",
            serial: "string, optional",
            status: "'success' or 'failed', optional"
        },

        async execute(args) {

            const query = {};

            if (args.licenseKey) query.licenseKey = clampString(args.licenseKey, 64);
            if (args.serial) query.serial = clampString(args.serial, 128);

            if (args.status === "success" || args.status === "failed") {
                query.status = args.status;
            }

            const logs = await UserLog.find(query)
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

    searchLicenses: {

        description:
            "Search license keys by exact key, type (public/premium), or status (active/expired/banned). Returns up to 15 matches.",

        destructive: false,

        parameters: {
            key: "string, optional (exact or partial license key)",
            type: "'public' or 'premium', optional",
            status: "'active', 'expired', or 'banned', optional"
        },

        async execute(args) {

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

            const licenses = await License.find(query)
                .sort({ createdAt: -1 })
                .limit(15)
                .lean();

            return licenses.map(l => ({

                key: l.key,
                type: l.type,
                status: l.status,
                expiry: l.expiry,
                maxUses: l.maxUses,
                usedCount: l.usedCount,
                devices: (l.devices || []).length,
                createdAt: l.createdAt

            }));

        }

    },

    findDevice: {

        description:
            "Look up a specific device by its serial: shows whether it's currently banned, and its most recent connection log.",

        destructive: false,

        parameters: {
            serial: "string, required"
        },

        async execute(args) {

            const serial = clampString(args.serial, 128);

            if (!serial) {
                throw new Error("A device serial is required.");
            }

            const banned = await BannedDevice.findOne({ serial }).lean();

            const lastLog = await UserLog.findOne({ serial })
                .sort({ createdAt: -1 })
                .lean();

            return {

                serial,
                isBanned: !!banned,
                bannedInfo: banned
                    ? {
                        reason: banned.reason,
                        bannedBy: banned.bannedBy,
                        bannedAt: banned.bannedAt
                    }
                    : null,

                lastSeen: lastLog
                    ? {
                        deviceModel: lastLog.deviceModel,
                        deviceBrand: lastLog.deviceBrand,
                        licenseKey: lastLog.licenseKey,
                        status: lastLog.status,
                        createdAt: lastLog.createdAt
                    }
                    : null

            };

        }

    },

    banDevice: {

        description:
            "Ban a device by its serial so it can no longer use any license key. Requires user confirmation before running.",

        destructive: true,

        parameters: {
            serial: "string, required",
            reason: "string, optional"
        },

        async execute(args, context) {

            const serial = clampString(args.serial, 128);

            if (!serial) {
                throw new Error("A device serial is required.");
            }

            const exists = await BannedDevice.findOne({ serial });

            if (exists) {
                throw new Error("This device is already banned.");
            }

            const lastLog = await UserLog.findOne({ serial })
                .sort({ createdAt: -1 })
                .lean();

            const banned = await BannedDevice.create({

                serial,
                userKey: lastLog ? lastLog.licenseKey : "",
                deviceBrand: lastLog ? lastLog.deviceBrand : "",
                deviceModel: lastLog ? lastLog.deviceModel : "",
                androidVersion: lastLog ? lastLog.androidVersion : "",
                appVersion: lastLog ? lastLog.appVersion : "",
                bannedBy: `${context.adminUsername} (AI Copilot)`,
                reason: clampString(args.reason || "Banned via AI Copilot", 200)

            });

            return {

                serial: banned.serial,
                reason: banned.reason

            };

        }

    },

    unbanDevice: {

        description:
            "Remove a device from the banned list by its serial. Requires user confirmation before running.",

        destructive: true,

        parameters: {
            serial: "string, required"
        },

        async execute(args) {

            const serial = clampString(args.serial, 128);

            if (!serial) {
                throw new Error("A device serial is required.");
            }

            const result = await BannedDevice.findOneAndDelete({ serial });

            if (!result) {
                throw new Error("No banned device found with that serial.");
            }

            return { serial };

        }

    },

    createLicense: {

        description:
            "Create a new license key. If no key is given, one is auto-generated using the panel's License Settings. Requires user confirmation before running.",

        destructive: true,

        parameters: {
            type: "'public' or 'premium', required",
            expiryDays: "number, optional (falls back to License Settings default)",
            maxUses: "number, optional (falls back to License Settings default)",
            key: "string, optional (auto-generated if omitted)"
        },

        async execute(args, context) {

            const type = args.type === "premium" ? "premium" : "public";

            const settings = await Settings.findOne();

            let expiryDays = clampNumber(args.expiryDays, 0, 3650, null);
            let maxUses = clampNumber(args.maxUses, 1, 100, null);

            if (expiryDays === null) {

                expiryDays = settings
                    ? (type === "premium" ? settings.license.premiumExpiry : settings.license.publicExpiry)
                    : 30;

            }

            if (maxUses === null) {

                maxUses = settings ? settings.license.maxDevices : 1;

            }

            let key = args.key ? clampString(args.key, 32).toUpperCase() : "";

            if (!key) {

                let attempts = 0;

                do {

                    key = generateKey(type, settings ? settings.license : null);
                    attempts++;

                } while (attempts < 10 && (await License.findOne({ key })));

            }

            const license = await createLicense(

                key,
                type,
                expiryDays,
                maxUses,
                `${context.adminUsername} (AI Copilot)`

            );

            return {

                key: license.key,
                type: license.type,
                expiry: license.expiry,
                maxUses: license.maxUses

            };

        }

    },

    exportLogs: {

        description:
            "Get a link the admin can click to export/download the full logs as CSV from the Logs page.",

        destructive: false,

        parameters: {},

        async execute() {

            return {

                message: "Use the Export button on the Logs page, or visit /logs/export while logged in.",

                url: "/logs/export"

            };

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
