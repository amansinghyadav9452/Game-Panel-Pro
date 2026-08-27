const mongoose = require("mongoose");

// Ek row = ek browser/device ka push subscription. "endpoint" hi
// unique hota hai (per browser install), isliye same admin/customer
// multiple devices se subscribe kare to alag-alag rows ban jaati
// hain aur sab ko push mil jaata hai.
const pushSubscriptionSchema = new mongoose.Schema({

    // "admin" | "developer" | "customer" - kisko push bhejni hai
    // decide karne ke liye. Admin/Developer dono Admin model se aate
    // hain isliye role yahin copy kar liya (adminId se role dubara
    // lookup karne se better/faster).
    ownerRole: {
        type: String,
        enum: ["admin", "developer", "customer"],
        required: true
    },

    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        default: null
    },

    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        default: null
    },

    endpoint: {
        type: String,
        required: true,
        unique: true
    },

    keys: {
        p256dh: {
            type: String,
            required: true
        },
        auth: {
            type: String,
            required: true
        }
    }

}, {
    timestamps: true
});

pushSubscriptionSchema.index({ ownerRole: 1, adminId: 1 });
pushSubscriptionSchema.index({ ownerRole: 1, customerId: 1 });

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);
