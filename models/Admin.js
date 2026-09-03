const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({

    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },

    displayName: {
    type: String,
    default: "Administrator"
    },

    // Game ID assigned to this admin's game/build. Verification and
    // admin-created licenses are isolated to this Game ID.
    gameId: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        uppercase: true,
        default: ""
    },

    twoFactorEnabled:{

    type:Boolean,

    default:false

},

twoFactorSecret:{

    type:String,

    default:""

},

email:{

    type:String,

    default:""

},

loginOtpCode:{

    type:String,

    default:""

},

loginOtpExpiresAt:{

    type:Date,

    default:null

},

loginOtpAttempts:{

    type:Number,

    default:0

},

setupOtpCode:{

    type:String,

    default:""

},

setupOtpExpiresAt:{

    type:Date,

    default:null

},

setupPendingEmail:{

    type:String,

    default:""

},

resetOtpCode:{

    type:String,

    default:""

},

resetOtpExpiresAt:{

    type:Date,

    default:null

},

resetOtpAttempts:{

    type:Number,

    default:0

},

    password: {
        type: String,
        required: true
    },

    profileImage: {
    type: String,
    default: ""
},

    sessionVersion:{

    type:Number,

    default:0

},

    role: {
        type: String,
        default: "admin"
    },

    // "Delete for me" cutoff for the admin<->developer chat widget —
    // messages created before this timestamp are hidden from this
    // account's history, without affecting the other side's view.
    chatClearedAt: {
        type: Date,
        default: null
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
        }
    }
],

currentRegistrationChallenge: {
    type: String,
    default: ""
},

currentAuthenticationChallenge: {
    type: String,
    default: ""
},

}, {
    timestamps: true
});

module.exports = mongoose.model("Admin", adminSchema);