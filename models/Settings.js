const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({

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

        email:{
            type:Boolean,
            default:false
        }

    }

},{
    timestamps:true
});

module.exports = mongoose.model("Settings", settingsSchema);