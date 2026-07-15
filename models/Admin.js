const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({

    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },

    twoFactorEnabled:{

    type:Boolean,

    default:false

},

twoFactorSecret:{

    type:String,

    default:""

},

    password: {
        type: String,
        required: true
    },

    sessionVersion:{

    type:Number,

    default:0

},

    role: {
        type: String,
        default: "admin"
    },

failedAttempts: {
    type: Number,
    default: 0
},

lockUntil: {
    type: Date,
    default: null
}

}, {
    timestamps: true
});

module.exports = mongoose.model("Admin", adminSchema);