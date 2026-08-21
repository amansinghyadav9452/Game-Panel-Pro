const mongoose = require("mongoose");

const gameApplicationSchema = new mongoose.Schema({
    gameId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
        minlength: 12,
        maxlength: 64
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80
    },
    ownerType: {
        type: String,
        enum: ["admin", "customer"],
        required: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        default: null
    },
    status: {
        type: String,
        enum: ["active", "disabled"],
        default: "active"
    }
}, { timestamps: true });

gameApplicationSchema.index({ customerId: 1 }, { unique: true, sparse: true });
gameApplicationSchema.index({ gameId: 1 }, { unique: true });

gameApplicationSchema.pre("validate", function(next) {
    if (this.ownerType === "customer" && !this.customerId) {
        return next(new Error("Customer application requires customerId."));
    }
    if (this.ownerType === "admin") {
        this.customerId = null;
    }
    next();
});

module.exports = mongoose.model("GameApplication", gameApplicationSchema);
