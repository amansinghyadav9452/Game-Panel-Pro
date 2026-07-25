const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({

    panelProfile: {

    displayName: {
        type: String,
        default: "Administrator"
    },

    profileImage: {
        type: String,
        default: ""
    }

},
    security:{

        turnstileEnabled:{
            type:Boolean,
            default:true
        },

        forceSingleLogin:{
            type:Boolean,
            default:false
        },

        sessionTimeout:{
            type:Number,
            default:60
        },

        jwtExpiry:{
            type:String,
            default:"1h"
        },

        maxLoginAttempts:{
            type:Number,
            default:5
        }

    },

    license:{

        publicExpiry:{
            type:Number,
            default:30
        },

        premiumExpiry:{
            type:Number,
            default:30
        },

        maxDevices:{
            type:Number,
            default:1
        },

        publicPrefix:{
            type:String,
            default:"PUB"
        },

        premiumPrefix:{
            type:String,
            default:"PREM"
        },

        licenseLength:{

    type:Number,

    default:16

},

autoUppercase:{

    type:Boolean,

    default:true

},

    },

api:{

    publicApiEnabled:{

        type:Boolean,

        default:true

    },

    premiumApiEnabled:{

        type:Boolean,

        default:true

    },

    maintenanceMode:{

        type:Boolean,

        default:false

    },

    rateLimit:{

        type:Number,

        default:100

    },

    version:{

        type:String,

        default:"v1"

    }

},

    appearance:{

        darkMode:{
            type:Boolean,
            default:true
        },

        accentColor:{
            type:String,
            default:"blue"
        },

        sidebarCollapsed:{
            type:Boolean,
            default:false
        },

        animationsEnabled:{
            type:Boolean,
            default:true
        }

    },

    logs:{

        retentionDays:{
            type:Number,
            default:30
        },

        displayRange:{
            type:String,
            enum:["live","2h","24h","7d","1m"],
            default:"24h"
        }

    },

    notifications:{

        telegram:{
            type:Boolean,
            default:false
        },

        discord:{
            type:Boolean,
            default:false
        },

        discordWebhookUrl:{
            type:String,
            default:""
        },

        email:{
            type:Boolean,
            default:false
        },

        criticalOnly:{
            type:Boolean,
            default:false
        }

    }

},{
    timestamps:true
});

module.exports = mongoose.model("Settings", settingsSchema);