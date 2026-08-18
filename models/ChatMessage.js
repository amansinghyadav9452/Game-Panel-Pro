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

    createdAt: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
