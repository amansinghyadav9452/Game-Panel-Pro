const mongoose = require("mongoose");

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

module.exports = mongoose.model("Activity", activitySchema);