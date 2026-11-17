const mongoose = require("mongoose");
const { invalidate } = require("../services/cacheService");

const activitySchema = new mongoose.Schema({

    action: {

        type: String,

        required: true

    },

    licenseKey: {

        type: String,

        required: true

    },

    licenseType: {

        type: String,

        enum: ["public", "premium"],

        required: true

    },

    admin: {

        type: String,

        required: true

    },

    details: {

        type: String,

        default: ""

    }

}, {

    timestamps: true

});

// The /activity/recent route always sorts by createdAt desc.
activitySchema.index({ createdAt: -1 });


activitySchema.post("save", async () => { await Promise.all([invalidate("admin:activity-logs"), invalidate("admin:dashboard")]); });
activitySchema.post("deleteMany", async () => { await Promise.all([invalidate("admin:activity-logs"), invalidate("admin:dashboard")]); });

module.exports = mongoose.model("Activity", activitySchema);