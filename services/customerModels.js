const mongoose = require("mongoose");
const { invalidate } = require("./cacheService");

// Same shape as models/License.js - kept as a separate definition
// (not imported from there) so nothing about the admin's own License
// collection/model is touched by this file.
const customerKeySchema = new mongoose.Schema({

    key: { type: String, required: true, unique: true },

    type: {
        type: String,
        enum: ["public", "premium"],
        required: true
    },

    status: {
        type: String,
        enum: ["active", "expired", "banned"],
        default: "active"
    },

    expiry: { type: Date, required: true },

    lastUsed: { type: Date, default: null },

    maxUses: { type: Number, default: 1 },

    usedCount: { type: Number, default: 0 },

    devices: [{ type: String }],

    lastDevice: { type: String, default: null },

    banReason: { type: String, default: "" }

}, { timestamps: true });


customerKeySchema.index({ type: 1, status: 1 });

function customerCacheNamespace(docOrQuery, suffix) {
    const collectionName = docOrQuery?.constructor?.collection?.collectionName
        || docOrQuery?.model?.collection?.collectionName
        || "";
    const match = collectionName.match(/^cust_([a-f0-9]+)_/i);
    return match ? `customer:${match[1]}:${suffix}` : null;
}

async function invalidateCustomerNamespace(docOrQuery, suffixes) {
    const namespaces = suffixes
        .map(suffix => customerCacheNamespace(docOrQuery, suffix))
        .filter(Boolean);
    await Promise.all(namespaces.map(invalidate));
}

customerKeySchema.post("save", async function(doc) {
    await invalidateCustomerNamespace(doc, ["keys", "dashboard"]);
});
customerKeySchema.post("findOneAndDelete", async function(doc) {
    await invalidateCustomerNamespace(this, ["keys", "dashboard"]);
});
customerKeySchema.post("deleteMany", async function() {
    await invalidateCustomerNamespace(this, ["keys", "dashboard"]);
});
customerKeySchema.post("updateMany", async function(result) {
    if (result?.modifiedCount > 0) {
        await invalidateCustomerNamespace(this, ["keys", "dashboard"]);
    }
});
customerKeySchema.post("findOneAndUpdate", async function() {
    await invalidateCustomerNamespace(this, ["keys", "dashboard"]);
});


// Keys CRUD actions (create/ban/unban/extend/delete/reset-device) done
// by this customer on their own keys.
const customerCrudLogSchema = new mongoose.Schema({

    action: { type: String, required: true },
    key: { type: String, required: true },
    type: { type: String, enum: ["public", "premium"] },
    details: { type: String, default: "" }

}, { timestamps: true });

customerCrudLogSchema.index({ createdAt: -1 });
customerCrudLogSchema.post("save", async function(doc) {
    await invalidateCustomerNamespace(doc, ["crud-logs", "dashboard"]);
});
customerCrudLogSchema.post("deleteMany", async function() {
    await invalidateCustomerNamespace(this, ["crud-logs", "dashboard"]);
});

// End-user (game client) verification attempts against this
// customer's keys - same idea as the admin's UserLog, just scoped.
const customerActivityLogSchema = new mongoose.Schema({

    licenseKey: String,
    licenseType: { type: String, enum: ["public", "premium"] },
    serial: String,
    deviceModel: String,
    deviceMarketingName: String,
    deviceBrand: String,
    androidVersion: String,
    appVersion: String,
    playerName: String,
    status: { type: String, enum: ["success", "failed"] },
    reason: String

}, { timestamps: true });

customerActivityLogSchema.index({ createdAt: -1 });
customerActivityLogSchema.post("save", async function(doc) {
    await invalidateCustomerNamespace(doc, ["activity-logs", "keys"]);
});
customerActivityLogSchema.post("deleteMany", async function() {
    await invalidateCustomerNamespace(this, ["activity-logs"]);
});

// Mongoose throws "Cannot overwrite model" if you call mongoose.model()
// twice with the same name - cache compiled models per customer so
// repeated requests reuse the same one instead of re-registering it.
const keyModelCache = new Map();
const crudLogModelCache = new Map();
const activityLogModelCache = new Map();

function getCustomerKeyModel(customerId) {

    const id = customerId.toString();

    if (!keyModelCache.has(id)) {

        const collectionName = `cust_${id}_keys`;
        const modelName = `CustomerKeys_${id}`;

        keyModelCache.set(
            id,
            mongoose.models[modelName] ||
                mongoose.model(modelName, customerKeySchema, collectionName)
        );

    }

    return keyModelCache.get(id);

}

function getCustomerCrudLogModel(customerId) {

    const id = customerId.toString();

    if (!crudLogModelCache.has(id)) {

        const collectionName = `cust_${id}_crud_logs`;
        const modelName = `CustomerCrudLog_${id}`;

        crudLogModelCache.set(
            id,
            mongoose.models[modelName] ||
                mongoose.model(modelName, customerCrudLogSchema, collectionName)
        );

    }

    return crudLogModelCache.get(id);

}

function getCustomerActivityLogModel(customerId) {

    const id = customerId.toString();

    if (!activityLogModelCache.has(id)) {

        const collectionName = `cust_${id}_activity_logs`;
        const modelName = `CustomerActivityLog_${id}`;

        activityLogModelCache.set(
            id,
            mongoose.models[modelName] ||
                mongoose.model(modelName, customerActivityLogSchema, collectionName)
        );

    }

    return activityLogModelCache.get(id);

}

module.exports = {
    getCustomerKeyModel,
    getCustomerCrudLogModel,
    getCustomerActivityLogModel
};
