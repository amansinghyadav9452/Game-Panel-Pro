const mongoose = require("mongoose");

// Admin's own keys stay in the single License collection exactly like
// before (zero change to that path). Customer keys live in their own
// per-customer collection for real isolation - this tiny index is the
// only shared place a key "exists" in one lookup, so /connect
// verification doesn't have to scan every customer's collection.
const keyIndexSchema = new mongoose.Schema({

    key: {
        type: String,
        required: true,
        unique: true
    },

    type: {
        type: String,
        enum: ["public", "premium"],
        required: true
    },

    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        required: true
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("KeyIndex", keyIndexSchema);
