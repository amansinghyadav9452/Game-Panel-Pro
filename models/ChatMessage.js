const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema({

    sender: {
        type: String,
        enum: ["admin", "developer"],
        required: true
    },

    senderLabel: {
        type: String,
        default: ""
    },

    text: {
        type: String,
        required: true,
        maxlength: 2000
    },

    readByAdmin: {
        type: Boolean,
        default: false
    },

    readByDeveloper: {
        type: Boolean,
        default: false
    },

    // Timestamp jab doosre role ne is message ko dekh liya (WhatsApp
    // jaisa "Seen at" dikhane ke liye). Sirf ek hi baar set hota hai.
    seenAt: {
        type: Date,
        default: null
    },

    // Unsend / delete support - text DB me hamesha rehta hai taaki
    // doosra role (jise msg mila tha) ye dekh sake ki unsend kiya gaya
    // msg tha kya. Sirf UI is flag ko dekh kar alag render karti hai.
    unsent: {
        type: Boolean,
        default: false
    },

    unsentAt: {
        type: Date,
        default: null
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
