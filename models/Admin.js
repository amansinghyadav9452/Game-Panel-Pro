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
},

biometricCredentials: [
    {
        credentialID: {
            type: Buffer,
            required: true,
            unique: true
        },

        publicKey: {
            type: Buffer,
            required: true
        },

        counter: {
            type: Number,
            default: 0
        },

        transports: {
            type: [String],
            default: []
        },

        deviceName: {
            type: String,
            default: "Unknown Device"
        },

        createdAt: {
            type: Date,
            default: Date.now
        },
        
        currentRegistrationChallenge: {
    type: String,
    default: ""
},
    }
],

}, {
    timestamps: true
});

module.exports = mongoose.model("Admin", adminSchema);